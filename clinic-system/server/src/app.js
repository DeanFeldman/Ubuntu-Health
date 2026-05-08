const express = require('express')
const cors = require('cors')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const { sendAppointmentConfirmationEmail } = require('./emailService')
const app = express()
const DEFAULT_ESTIMATED_WAIT_APPOINTMENT_DURATION = 15
const ESTIMATED_WAIT_FALLBACK_MESSAGE = 'Estimated wait time may be inaccurate'

const {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
} = require('./queueNotificationService')
const {
  generateDailySlots,
  resolveClinicSchedule,
} = require('./clinicSchedule')
const {
  validateRequiredUuid,
  validateRequiredUuids,
} = require('./commonValidation')
app.use(cors())
app.use(express.json())

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY')
}

const supabase = createClient(supabaseUrl, supabaseKey)
configureQueueNotificationService(supabase)


async function fetchActiveQueueSnapshot(clinicId) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select('id, clinic_id, patient_id, position, status')
    .eq('clinic_id', clinicId)
    .in('status', ['Waiting', 'Called', 'In Consultation'])
    .order('position', { ascending: true })

  if (error) throw error

  return data || []
}

async function tryFetchActiveQueueSnapshot(clinicId) {
  try {
    return await fetchActiveQueueSnapshot(clinicId)
  } catch (err) {
    console.error('Failed to fetch queue snapshot for notifications:', err)
    return []
  }
}

async function triggerQueueNotificationsForClinicSafely(clinicId, oldQueue) {
  try {
    const newQueue = await fetchActiveQueueSnapshot(clinicId)
    const createdNotifications = await checkAndTriggerNotifications(oldQueue, newQueue)

    console.log('QUEUE NOTIFICATION CHECK:', {
      clinicId,
      oldQueue: oldQueue.map(({ id, patient_id, position, status }) => ({
        id,
        patient_id,
        position,
        status,
      })),
      newQueue: newQueue.map(({ id, patient_id, position, status }) => ({
        id,
        patient_id,
        position,
        status,
      })),
      createdNotifications,
    })

    return createdNotifications
  } catch (err) {
    console.error('Failed to trigger queue notifications:', err)
    return []
  }
}

function withResolvedClinicSchedule(clinic) {
  const schedule = resolveClinicSchedule(clinic)

  return {
    ...clinic,
    operating_hours: schedule.operating_hours,
    appointment_duration_minutes: schedule.appointment_duration_minutes,
  }
}

async function fetchClinicQueueMetrics(clinicId) {
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('appointment_duration_minutes')
    .eq('id', clinicId)
    .maybeSingle()

  if (clinicError) throw clinicError
  if (!clinic) return null

  const rawAppointmentDuration = Number(clinic.appointment_duration_minutes)
  const hasAppointmentDuration =
    Number.isFinite(rawAppointmentDuration) && rawAppointmentDuration > 0
  const appointmentDuration = hasAppointmentDuration
    ? rawAppointmentDuration
    : DEFAULT_ESTIMATED_WAIT_APPOINTMENT_DURATION

  const { count, error: staffError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .in('role', ['Staff', 'Admin'])

  if (staffError) throw staffError

  const rawStaffCount = Number(count)
  const hasStaffCount = Number.isFinite(rawStaffCount) && rawStaffCount > 0

  return {
    appointmentDuration,
    staffCount: hasStaffCount ? rawStaffCount : 0,
    fallbackUsed: !hasAppointmentDuration || !hasStaffCount,
  }
}

function calculateEstimatedWaitTime({
  patientsAhead,
  appointmentDuration,
  staffCount,
}) {
  const rawStaffCount = Number(staffCount)

  if (!Number.isFinite(rawStaffCount) || rawStaffCount <= 0) {
    return {
      estimatedWaitTime: null,
      message: 'Estimate not available',
    }
  }

  const safePatientsAhead = Math.max(Number(patientsAhead) || 0, 0)

  const rawAppointmentDuration = Number(appointmentDuration)
  const safeAppointmentDuration =
    Number.isFinite(rawAppointmentDuration) && rawAppointmentDuration > 0
      ? rawAppointmentDuration
      : DEFAULT_ESTIMATED_WAIT_APPOINTMENT_DURATION

  return {
    estimatedWaitTime:
      safePatientsAhead === 0
        ? 0
        : Math.ceil((safePatientsAhead * safeAppointmentDuration) / rawStaffCount),
  }
}

async function fetchWaitingQueuePosition(clinicId, patientId) {
  const { data, error } = await supabase
    .from('queue_entries')
    .select('position')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .eq('status', 'Waiting')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const { count: patientsAhead, error: countError } = await supabase
    .from('queue_entries')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'Waiting')
    .lt('position', data.position)

  if (countError) throw countError

  return {
    position: data.position,
    patientsAhead: patientsAhead || 0,
  }
}
function getTimeFromAppointmentDatetime(slotDatetime) {
  if (!slotDatetime) return null

  if (typeof slotDatetime === 'string' && /^\d{2}:\d{2}$/.test(slotDatetime)) {
    return slotDatetime
  }

  const parsedDate = new Date(slotDatetime)
  if (Number.isNaN(parsedDate.getTime())) return null

  return parsedDate.toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const {
  isValidDateFormat,
  normalizeSlotTime,
  validateSlotRetrievalInput,
  validateGeneratedSlots,
  validateSelectedSlot,
  removeFullyBookedSlots,
} = require('./appointmentSlotValidation')

async function fetchClinicBookingCapacity(clinicId) {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .in('role', ['Staff', 'Admin'])

    if (error) throw error

    const parsedCount = Number(count)

    return Number.isFinite(parsedCount) && parsedCount > 0
      ? parsedCount
      : 1
  } catch (err) {
    return 1
  }
}

async function fetchBookedSlotTimes(clinicId, startIso, endIso) {
  const staffCount = await fetchClinicBookingCapacity(clinicId)

  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('slot_id')
    .eq('clinic_id', clinicId)
    .in('status', BOOKED_APPOINTMENT_STATUSES)

  if (appointmentsError) throw appointmentsError

  const slotIds = [
    ...new Set((appointments || []).map(appointment => appointment.slot_id).filter(Boolean)),
  ]

  if (slotIds.length === 0) {
    return new Set()
  }

  const { data: slots, error: slotsError } = await supabase
    .from('slots')
    .select('id, slot_datetime')
    .in('id', slotIds)

  if (slotsError) throw slotsError

  const slotById = Object.fromEntries((slots || []).map(slot => [slot.id, slot]))
  const bookingCountByTime = {}

  for (const appointment of appointments || []) {
    const slot = slotById[appointment.slot_id]
    if (!slot?.slot_datetime) continue

    const slotDate = slot.slot_datetime.slice(0, 10)
    const startDate = startIso.slice(0, 10)

    if (slotDate !== startDate) continue

    const time = getTimeFromAppointmentDatetime(slot.slot_datetime)
    if (!time) continue

    bookingCountByTime[time] = (bookingCountByTime[time] || 0) + 1
  }

  return new Set(
    Object.entries(bookingCountByTime)
      .filter(([, count]) => count >= staffCount)
      .map(([time]) => time)
  )
}

async function findOrCreateClinicSlot(clinicId, slotDatetimeIso) {
  const { data: existingSlot, error: existingSlotError } = await supabase
    .from('slots')
    .select('id, slot_datetime')
    .eq('clinic_id', clinicId)
    .eq('slot_datetime', slotDatetimeIso)
    .maybeSingle()

  if (existingSlotError) throw existingSlotError

  if (existingSlot) {
    return existingSlot
  }

  const { data: createdSlot, error: createdSlotError } = await supabase
    .from('slots')
    .insert({
      clinic_id: clinicId,
      slot_datetime: slotDatetimeIso,
    })
    .select('id, slot_datetime')
    .single()

  if (createdSlotError) throw createdSlotError

  return createdSlot
}

async function countActiveAppointmentsForSlot(clinicId, slotId) {
  if (!slotId) return 0

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('slot_id', slotId)
    .in('status', BOOKED_APPOINTMENT_STATUSES)

  if (error) throw error

  const parsedCount = Number(count)
  return Number.isFinite(parsedCount) ? parsedCount : 0
}

async function updateSlotAvailability(slotId, isAvailable) {
  if (!slotId) return

  const { error } = await supabase
    .from('slots')
    .update({ is_available: isAvailable })
    .eq('id', slotId)

  if (error) throw error
}

async function refreshSlotAvailability({ clinicId, slotId, capacity }) {
  if (!slotId) return

  const activeCount = await countActiveAppointmentsForSlot(clinicId, slotId)
  const safeCapacity = Number.isFinite(Number(capacity)) && Number(capacity) > 0
    ? Number(capacity)
    : 1

  await updateSlotAvailability(slotId, activeCount < safeCapacity)
}

async function resequenceQueue(clinicId) {
  const { data: activeEntries, error: fetchError } = await supabase
    .from('queue_entries')
    .select('id, patient_id, joined_at')
    .eq('clinic_id', clinicId)
    .in('status', ['Waiting', 'Called'])
    .order('joined_at', { ascending: true })

  if (fetchError) throw fetchError

  for (let i = 0; i < activeEntries.length; i += 1) {
    const entry = activeEntries[i]
    const newPosition = i + 1

    const { error: updateError } = await supabase
      .from('queue_entries')
      .update({ position: newPosition })
      .eq('id', entry.id)
      .eq('clinic_id', clinicId)

    if (updateError) throw updateError
  }

  const { data: checkRows, error: checkError } = await supabase
    .from('queue_entries')
    .select('id, patient_id, position, status')
    .eq('clinic_id', clinicId)
    .in('status', ['Waiting', 'Called', 'In Consultation'])
    .order('position', { ascending: true })

  if (checkError) throw checkError

  console.log('QUEUE AFTER RESEQUENCE:', checkRows)
}

// API health check
app.get('/api', (req, res) => {
  res.json({ message: 'Ubuntu Health API running' })
})

// GET /api/clinics
app.get('/api/clinics', async (req, res) => {
  try {
    const { province, district, municipality, facility_type, search } = req.query
    let query = supabase.from('clinics').select('*')
    if (province) query = query.eq('province', province)
    if (district) query = query.eq('district', district)
    if (facility_type) query = query.eq('facility_type', facility_type)
    if (municipality) query = query.eq('municipality', municipality)
    if (search) query = query.ilike('name', `%${search}%`)
    query = query.range(0, 9999)
    const { data, error } = await Promise.race([
  query,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error('CLINICS_QUERY_TIMEOUT')), 10000)
  }),
])

    if (error) throw error

    return res.status(200).json({
      clinics: (data || []).map(withResolvedClinicSchedule),
    })
  } catch (err) {
    if (err?.message === 'CLINICS_QUERY_TIMEOUT') {
      return res.status(200).json({ clinics: [] })
    }

    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// GET /api/clinics/:id/queue-metrics
app.get('/api/clinics/:id/queue-metrics', async (req, res) => {
  try {
    const { id } = req.params
    const idValidation = validateRequiredUuid(id, 'clinic ID')

    if (!idValidation.valid) {
      return res.status(idValidation.status).json({ error: idValidation.error })
    }

    const metrics = await fetchClinicQueueMetrics(id)

    if (!metrics) {
      return res.status(404).json({ error: 'Clinic not found' })
    }

    return res.json({
      appointmentDuration: metrics.appointmentDuration,
      staffCount: metrics.staffCount,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch clinic queue metrics' })
  }
})

// GET /api/clinics/:id
app.get('/api/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

    const idValidation = validateRequiredUuid(id, 'clinic ID')

    if (!idValidation.valid) {
      return res.status(idValidation.status).json({ error: idValidation.error })
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Clinic not found' })

    res.json({ clinic: withResolvedClinicSchedule(data) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic' })
  }
})

// GET /api/queue/:clinicId — retrieve full queue for a clinic for staff only
app.get('/api/queue/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params

    const idValidation = validateRequiredUuid(clinicId, 'clinic ID')

if (!idValidation.valid) {
  return res.status(idValidation.status).json({ error: idValidation.error })
}

    const { data: queueData, error: queueError } = await supabase
      .from('queue_entries')
      .select(`
        id,
        clinic_id,
        patient_id,
        position,
        status,
        joined_at,
        called_at,
        completed_at
      `)
      .eq('clinic_id', clinicId)
      .in('status', ['Waiting', 'Called', 'In Consultation'])
      .order('position', { ascending: true })

    if (queueError) throw queueError

    const patientIds = [...new Set((queueData || []).map(entry => entry.patient_id))]

    let usersById = {}
    if (patientIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', patientIds)

      if (usersError) throw usersError

      usersById = Object.fromEntries((users || []).map(user => [user.id, user]))
    }

    const queueWithNames = (queueData || []).map(entry => ({
      ...entry,
      patient: usersById[entry.patient_id]
        ? {
            full_name: usersById[entry.patient_id].full_name,
            email: usersById[entry.patient_id].email || null,
          }
        : null,
    }))

    res.json({
      debug: 'manual-name-join-live',
      queue: queueWithNames,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic queue' })
  }
})


// GET /api/queue/:clinicId/estimated-wait-time/:patientId — retrieve a patient's estimated wait time
app.get('/api/queue/:clinicId/estimated-wait-time/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const idValidation = validateRequiredUuids({ clinicId, patientId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}


    const queuePosition = await fetchWaitingQueuePosition(clinicId, patientId)

    if (!queuePosition) {
      return res.status(404).json({ error: 'No active queue entry found for this patient' })
    }

    const queueMetrics = await fetchClinicQueueMetrics(clinicId)
    const appointmentDuration =
      queueMetrics?.appointmentDuration ??
      DEFAULT_ESTIMATED_WAIT_APPOINTMENT_DURATION
    const staffCount = queueMetrics?.staffCount ?? 0
  
    const waitEstimate = calculateEstimatedWaitTime({
      patientsAhead: queuePosition.patientsAhead,
      appointmentDuration,
      staffCount,
    })

    return res.json({
      position: queuePosition.position,
      patientsAhead: queuePosition.patientsAhead,
      appointmentDuration,
      staffCount,
      estimatedWaitTime: waitEstimate.estimatedWaitTime,
      message: waitEstimate.message,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch estimated wait time' })
  }
})

// GET /api/queue/:clinicId/position/:patientId — retrieve a patient's position in the queue
app.get('/api/queue/:clinicId/position/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const idValidation = validateRequiredUuids({ clinicId, patientId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const queuePosition = await fetchWaitingQueuePosition(clinicId, patientId)

    if (!queuePosition) {
      return res.status(404).json({ error: 'No active queue entry found for this patient' })
    }

    const queueMetrics = await fetchClinicQueueMetrics(clinicId)
    const appointmentDuration =
      queueMetrics?.appointmentDuration ??
      DEFAULT_ESTIMATED_WAIT_APPOINTMENT_DURATION
    const staffCount = queueMetrics?.staffCount ?? 1
    const waitEstimate = calculateEstimatedWaitTime({
      patientsAhead: queuePosition.patientsAhead,
      appointmentDuration,
      staffCount,
    })

    const response = {
      position: queuePosition.position,
      patientsAhead: queuePosition.patientsAhead,
      estimatedWaitTime: waitEstimate.estimatedWaitTime,
    }

    if (queueMetrics?.fallbackUsed || waitEstimate.fallbackUsed || !queueMetrics) {
      response.message = ESTIMATED_WAIT_FALLBACK_MESSAGE
    }

    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue position' })
  }
})

// GET /api/queue/:clinicId/entry/:patientId — retrieve a patient's full active queue entry
app.get('/api/queue/:clinicId/entry/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const idValidation = validateRequiredUuids({ clinicId, patientId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const { data, error } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['Waiting', 'Called'])
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ entry: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue entry' })
  }
})

// POST /api/role-requests — submit a new role request
const {
  hasRequiredRoleRequestFields,isValidUuid,isValidRequestedRole, isDifferentFromCurrentRole,doesUserExist, 
  hasDuplicatePendingRoleRequest,} = require('./roleRequestValidation')
app.post('/api/role-requests', async (req, res) => {
  try {
    const { user_id, requested_role } = req.body

    if (!hasRequiredRoleRequestFields(user_id, requested_role)) {
      return res.status(400).json({
        error: 'user_id and requested_role are required'
      })
    }

    if (!isValidUuid(user_id)) {
      return res.status(400).json({ error: 'Invalid user ID format' })
    }

    if (!isValidRequestedRole(requested_role)) {
      return res.status(400).json({ error: 'Invalid requested role' })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user_id)
      .maybeSingle()

    if (userError) throw userError

    if (!doesUserExist(user)) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!isDifferentFromCurrentRole(user.role, requested_role)) {
      return res.status(400).json({ error: 'User already has this role' })
    }

    const { data: existingRequest, error: existingError } = await supabase
      .from('role_requests')
      .select('id')
      .eq('user_id', user_id)
      .eq('requested_role', requested_role)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingError) throw existingError

    if (hasDuplicatePendingRoleRequest(existingRequest)) {
      return res.status(409).json({
        error: 'A pending request for this role already exists'
      })
    }

    const { data, error } = await supabase
      .from('role_requests')
      .insert({
        user_id,
        requested_role,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ request: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to submit role request' })
  }
})

// GET /api/role-requests — admin fetches role requests
app.get('/api/role-requests', async (req, res) => {
  try {
    const { admin_id, status } = req.query

    const adminIdValidation = validateRequiredUuid(admin_id, 'admin_id')

if (!adminIdValidation.valid) {
  return res.status(adminIdValidation.status).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid admin ID format',
  })
}

    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can access role requests' })
    }

    let query = supabase
      .from('role_requests')
      .select(`
        id,
        user_id,
        requested_role,
        status,
        created_at,
        users (
          full_name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ requests: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch role requests' })
  }
})
// GET /api/queue/:clinicId/status/:patientId — retrieve just the status of a patient's queue entry
app.get('/api/queue/:clinicId/status/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const idValidation = validateRequiredUuids({ clinicId, patientId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}
    const { data, error } = await supabase
      .from('queue_entries')
      .select('status, position, joined_at')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .in('status', ['Waiting', 'Called', 'In Consultation'])
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ status: data.status, position: data.position, joined_at: data.joined_at })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue status' })
  }
})
// PATCH /api/role-requests/:id/approve — admin approves a pending role request
app.patch('/api/role-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    const requestIdValidation = validateRequiredUuid(id, 'request ID')

if (!requestIdValidation.valid) {
  return res
    .status(requestIdValidation.status)
    .json({ error: 'Invalid request ID format' })
}

const adminIdValidation = validateRequiredUuid(admin_id, 'admin_id')

if (!adminIdValidation.valid) {
  return res.status(adminIdValidation.status).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid admin ID format',
  })
}

    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can approve role requests' })
    }

    const { data: roleRequest, error: requestError } = await supabase
      .from('role_requests')
      .select('id, user_id, requested_role, status, users ( role )')
      .eq('id', id)
      .maybeSingle()

    if (requestError) throw requestError

    if (!roleRequest) {
      return res.status(404).json({ error: 'Role request not found' })
    }

    if (roleRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Role request has already been reviewed' })
    }

    const previousRole = roleRequest.users?.role

    if (!previousRole) {
      return res.status(404).json({ error: 'Request user not found' })
    }

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ role: roleRequest.requested_role })
      .eq('id', roleRequest.user_id)

    if (userUpdateError) throw userUpdateError

    const { data: approvedRequest, error: requestUpdateError } = await supabase
      .from('role_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    if (requestUpdateError || !approvedRequest) {
      const { error: rollbackError } = await supabase
        .from('users')
        .update({ role: previousRole })
        .eq('id', roleRequest.user_id)

      if (rollbackError) {
        console.error('Failed to roll back user role after approval error:', rollbackError)
      }

      if (!approvedRequest) {
        return res.status(409).json({ error: 'Role request is no longer pending' })
      }

      throw requestUpdateError
    }

    res.json({ request: approvedRequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to approve role request' })
  }
})

// PATCH /api/role-requests/:id/reject — admin rejects a pending role request
app.patch('/api/role-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const { admin_id } = req.body

    const requestIdValidation = validateRequiredUuid(id, 'request ID')

if (!requestIdValidation.valid) {
  return res
    .status(requestIdValidation.status)
    .json({ error: 'Invalid request ID format' })
}

const adminIdValidation = validateRequiredUuid(admin_id, 'admin_id')

if (!adminIdValidation.valid) {
  return res.status(adminIdValidation.status).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid admin ID format',
  })
}

    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can reject role requests' })
    }

    const { data: rejectedRequest, error: requestUpdateError } = await supabase
      .from('role_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle()

    if (requestUpdateError) throw requestUpdateError

    if (!rejectedRequest) {
      return res.status(409).json({ error: 'Role request is no longer pending' })
    }

    res.json({ request: rejectedRequest })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to reject role request' })
  }
})

// POST /api/queue/:clinicId/join — patient joins the virtual queue
const { validateQueueJoin, findSameDayClinicAppointment } = require('./queueValidation')

app.post('/api/queue/:clinicId/join', async (req, res) => {
  try {
    const { clinicId } = req.params
    const { patient_id, confirmed } = req.body

   const idValidation = validateRequiredUuids({ clinicId, patient_id })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id')
      .eq('id', clinicId)
      .maybeSingle()

    if (clinicError) throw clinicError
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' })
    }

    // Fetch all active queue entries for this patient across all clinics
    const { data: activeQueues, error: activeError } = await supabase
      .from('queue_entries')
      .select('patient_id, status, clinic_id')
      .eq('patient_id', patient_id)
      .neq('status', 'Complete')

    if (activeError) throw activeError

    // Use validation helper — checks confirmed and no active queue
    if (!validateQueueJoin(patient_id, activeQueues, confirmed)) {
      if (!confirmed) {
        return res.status(400).json({ error: 'Queue join must be confirmed by the patient' })
      }
      return res.status(409).json({ error: 'Patient already has an active queue entry' })
    }

    const oldQueue = await tryFetchActiveQueueSnapshot(clinicId)

    // Calculate next position in this clinic's queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue_entries')
      .select('position')
      .eq('clinic_id', clinicId)
      .eq('status', 'Waiting')
      .order('position', { ascending: false })
      .limit(1)

    if (queueError) throw queueError

    const nextPosition = queueData.length > 0 ? queueData[0].position + 1 : 1

    // Insert new queue entry
    const { data: newEntry, error: insertError } = await supabase
      .from('queue_entries')
      .insert({
        clinic_id: clinicId,
        patient_id: patient_id,
        position: nextPosition,
        status: 'Waiting',
        joined_at: new Date().toISOString()
      })
      .select()
      .single()
    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({
        error: 'Patient already has an active queue entry'
      })
    }
      throw insertError
  }
    //if (insertError) throw insertError

    const queueNotifications = await triggerQueueNotificationsForClinicSafely(clinicId, oldQueue)

    // US-29-1-1: Check for a same-day appointment at this clinic
    const today = new Date().toISOString().slice(0, 10)

    const { data: patientAppointments, error: apptError } = await supabase
      .from('appointments')
      .select('id, clinic_id, slot_id, status')
      .eq('patient_id', patient_id)
      .in('status', ['Confirmed', 'Waiting'])

    if (apptError) throw apptError

    const slotIds = [...new Set((patientAppointments || []).map(a => a.slot_id).filter(Boolean))]
    let appointmentsWithDatetime = []

    if (slotIds.length > 0) {
      const { data: slots, error: slotsError } = await supabase
        .from('slots')
        .select('id, slot_datetime')
        .in('id', slotIds)

      if (slotsError) throw slotsError

      const slotsById = Object.fromEntries((slots || []).map(s => [s.id, s]))

      appointmentsWithDatetime = (patientAppointments || []).map(a => ({
        ...a,
        slot_datetime: slotsById[a.slot_id]?.slot_datetime || null,
      }))
    }

    // US-29-1-1: Find matching same-day appointment at this clinic
    const matchedAppointment = findSameDayClinicAppointment(appointmentsWithDatetime, clinicId, today)

    // US-29-1-2: Update matched appointment status to Waiting
    let linkedAppointment = null
    if (matchedAppointment) {
      const { data: updatedAppointment, error: updateApptError } = await supabase
        .from('appointments')
        .update({ status: 'Waiting' })
        .eq('id', matchedAppointment.id)
        .select('id, clinic_id, slot_id, status')
        .single()

      if (updateApptError) {
        console.error('Failed to update appointment status on queue join:', updateApptError)
      } else {
        linkedAppointment = {
          ...updatedAppointment,
          slot_datetime: matchedAppointment.slot_datetime,
        }
      }
    }

    // US-29-2-1: Return appointment time in response if linked
    res.status(201).json({
      entry: newEntry,
      queue_notifications: queueNotifications,
      linked_appointment: linkedAppointment
        ? {
            id: linkedAppointment.id,
            status: linkedAppointment.status,
            slot_datetime: linkedAppointment.slot_datetime,
            appointment_time: linkedAppointment.slot_datetime
              ? getTimeFromAppointmentDatetime(linkedAppointment.slot_datetime)
              : null,
          }
        : null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to join queue' })
  }
})

// PATCH /api/queue/:clinicId/entry/:entryId/status — staff updates a patient's queue status
const { isValidStatusTransition } = require('./queueValidation')

app.patch('/api/queue/:clinicId/entry/:entryId/status', async (req, res) => {
  try {
    const { clinicId, entryId } = req.params
    const { status } = req.body

    const idValidation = validateRequiredUuids({ clinicId, entryId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const validStatuses = ['Waiting', 'In Consultation', 'Complete', 'Called']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }

    // Fetch current entry to validate transition
    const { data: currentEntry, error: fetchError } = await supabase
      .from('queue_entries')
      .select('status')
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!currentEntry) return res.status(404).json({ error: 'Queue entry not found' })

    if (!isValidStatusTransition(currentEntry.status, status)) {
      return res.status(409).json({ error: `Invalid status transition from ${currentEntry.status} to ${status}` })
    }

    const oldQueue = await tryFetchActiveQueueSnapshot(clinicId)

    const updateData = { status }

    if (status === 'In Consultation') {
      updateData.called_at = new Date().toISOString()
      updateData.position = 0
    }

    if (status === 'Complete') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data: updatedEntry, error: updateError } = await supabase
      .from('queue_entries')
      .update(updateData)
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (updateError) throw updateError

    if (['In Consultation', 'Complete'].includes(status)) {
      await resequenceQueue(clinicId)
    }
    

    const queueNotifications = await triggerQueueNotificationsForClinicSafely(clinicId, oldQueue)

    const shouldNotifyPatientCalled =
      currentEntry.status === 'Waiting' &&
      updatedEntry.status === 'In Consultation'

    if (shouldNotifyPatientCalled) {
      await supabase
        .from('notifications')
        .insert({
          user_id: updatedEntry.patient_id,
          type: 'queue_alert',
          channel: 'push',
          message: 'You are being called — please make your way to the consultation room.',
          sent_at: new Date().toISOString(),
          delivered: false
        })
    }

    res.json({ entry: updatedEntry, queue_notifications: queueNotifications })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update queue status' })
  }
})

// DELETE /api/queue/:clinicId/entry/:entryId — staff removes a patient from the queue
app.delete('/api/queue/:clinicId/entry/:entryId', async (req, res) => {
  try {
    const { clinicId, entryId } = req.params

    const idValidation = validateRequiredUuids({ clinicId, entryId })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const oldQueue = await tryFetchActiveQueueSnapshot(clinicId)

    const { data: existingEntry, error: fetchError } = await supabase
      .from('queue_entries')
      .select('id')
      .eq('id', entryId)
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existingEntry) return res.status(404).json({ error: 'Queue entry not found' })

    const { error: deleteError } = await supabase
      .from('queue_entries')
      .delete()
      .eq('id', entryId)
      .eq('clinic_id', clinicId)

    if (deleteError) throw deleteError

    const { error: resequenceError } = await supabase.rpc('resequence_queue', {
      clinic: clinicId,
    })

    if (resequenceError) throw resequenceError

    const queueNotifications = await triggerQueueNotificationsForClinicSafely(clinicId, oldQueue)

    res.json({
      message: 'Patient removed from queue successfully',
      queue_notifications: queueNotifications,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to remove patient from queue' })
  }
})

// GET /api/queue-notifications/:patientId — patient fetches queue position alerts
app.get('/api/queue-notifications/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params
    const { queue_entry_id } = req.query

    const patientIdValidation = validateRequiredUuid(patientId, 'patient ID')

if (!patientIdValidation.valid) {
  return res
    .status(patientIdValidation.status)
    .json({ error: patientIdValidation.error })
}

if (queue_entry_id) {
  const queueEntryIdValidation = validateRequiredUuid(queue_entry_id, 'queue entry ID')

  if (!queueEntryIdValidation.valid) {
    return res
      .status(queueEntryIdValidation.status)
      .json({ error: queueEntryIdValidation.error })
  }
}

    let query = supabase
      .from('queue_notifications')
      .select('id, queue_entry_id, clinic_id, type, position, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (queue_entry_id) {
      query = query.eq('queue_entry_id', queue_entry_id)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ notifications: data || [] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue notifications' })
  }
})


// GET /api/clinic-requests?admin_id=...&status=pending
app.get('/api/clinic-requests', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const { admin_id, status } = req.query

    const adminIdValidation = validateRequiredUuid(admin_id, 'admin_id')

if (!adminIdValidation.valid) {
  return res.status(adminIdValidation.status).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid admin ID format',
  })
}

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .single()

    if (adminError || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (admin.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can view clinic requests' })
    }

    let query = supabase
      .from('clinic_requests')
      .select(`
        *,
        users:staff_user_id ( id, full_name, email, role ),
        clinics:clinic_id ( id, name, facility_type, province )
      `)
      .order('created_at', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return res.json({ requests: data || [] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to load clinic requests' })
  }
})

// PATCH /api/clinic-requests/:id/approve
app.patch('/api/clinic-requests/:id/approve', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const { id } = req.params
    const { admin_id } = req.body

    const idValidation = validateRequiredUuids({ id, admin_id })

if (!idValidation.valid) {
  return res.status(400).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid request or admin ID format',
  })
}

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .single()

    if (adminError || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (admin.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can approve clinic requests' })
    }

    const { data: request, error: requestError } = await supabase
      .from('clinic_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Clinic request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be approved' })
    }

    const { error: assignError } = await supabase
      .from('users')
      .update({ clinic_id: request.clinic_id })
      .eq('id', request.staff_user_id)

    if (assignError) throw assignError

    const { data, error } = await supabase
      .from('clinic_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin_id,
      })
      .eq('id', id)
      .select(`
        *,
        users:staff_user_id ( id, full_name, email, role, clinic_id ),
        clinics:clinic_id ( id, name, facility_type, province )
      `)
      .single()

    if (error) throw error

    return res.json({
      message: 'Clinic request approved',
      request: data,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to approve clinic request' })
  }
})

// PATCH /api/clinic-requests/:id/reject
app.patch('/api/clinic-requests/:id/reject', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' })
    }

    const { id } = req.params
    const { admin_id } = req.body

    const idValidation = validateRequiredUuids({ id, admin_id })

if (!idValidation.valid) {
  return res.status(400).json({
    error: !admin_id ? 'admin_id is required' : 'Invalid request or admin ID format',
  })
}

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .single()

    if (adminError || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (admin.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can reject clinic requests' })
    }

    const { data: request, error: requestError } = await supabase
      .from('clinic_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Clinic request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be rejected' })
    }

    const { data, error } = await supabase
      .from('clinic_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin_id,
      })
      .eq('id', id)
      .select(`
        *,
        users:staff_user_id ( id, full_name, email, role ),
        clinics:clinic_id ( id, name, facility_type, province )
      `)
      .single()

    if (error) throw error

    return res.json({
      message: 'Clinic request rejected',
      request: data,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to reject clinic request' })
  }
})

const {
  isValidUuid: isValidClinicUuid,
  isAdminUser,
  canAssignStaffToClinic,
  canUnassignStaff,
  validateClinicUpdatePayload,
  normalizeServicesInput,
} = require('./clinicManagementValidation')
// PATCH /api/users/:userId/assign-clinic — admin assigns a staff member to a clinic
app.patch('/api/users/:userId/assign-clinic', async (req, res) => {
  try {
    const { userId } = req.params
    const { admin_id, clinic_id } = req.body

    const idValidation = validateRequiredUuids({ userId, admin_id, clinic_id })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .single()

    if (adminError || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (!isAdminUser(admin)) {
      return res.status(403).json({ error: 'Only admins can assign staff to clinics' })
    }

    const { data: selectedUser, error: userError } = await supabase
      .from('users')
      .select('id, role, full_name, clinic_id')
      .eq('id', userId)
      .single()

    if (userError || !selectedUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const assignmentCheck = canAssignStaffToClinic(selectedUser, clinic_id)
    if (!assignmentCheck.valid) {
      return res.status(assignmentCheck.status).json({ error: assignmentCheck.error })
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', clinic_id)
      .single()

    if (clinicError || !clinic) {
      return res.status(404).json({ error: 'Clinic not found' })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ clinic_id })
      .eq('id', userId)
      .select('id, full_name, role, clinic_id')
      .single()

    if (error) throw error

    res.json({
      message: `${data.full_name} assigned to ${clinic.name}`,
      user: data,
      clinic,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to assign staff to clinic' })
  }
})

// PATCH /api/users/:userId/unassign-clinic — admin removes a staff member from their clinic
app.patch('/api/users/:userId/unassign-clinic', async (req, res) => {
  try {
    const { userId } = req.params
    const { admin_id } = req.body

    const idValidation = validateRequiredUuids({ userId, admin_id })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .single()

    if (adminError || !admin) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (!isAdminUser(admin)) {
      return res.status(403).json({ error: 'Only admins can unassign staff from clinics' })
    }

    const { data: selectedUser, error: userError } = await supabase
      .from('users')
      .select('id, role, full_name, clinic_id')
      .eq('id', userId)
      .single()

    if (userError || !selectedUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    const unassignCheck = canUnassignStaff(selectedUser)
    if (!unassignCheck.valid) {
      return res.status(unassignCheck.status).json({ error: unassignCheck.error })
    }

    const { data, error } = await supabase
      .from('users')
      .update({ clinic_id: null })
      .eq('id', userId)
      .select('id, full_name, role, clinic_id')
      .single()

    if (error) throw error

    res.json({
      message: `${data.full_name} unassigned from clinic`,
      user: data,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to unassign staff from clinic' })
  }
})
//PATCH /api/clinics/:id
app.patch('/api/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      admin_id,
      name,
      facility_type,
      operating_hours,
      appointment_duration_minutes,
      services,
    } = req.body

    const clinicIdValidation = validateRequiredUuid(id, 'clinic ID')

if (!clinicIdValidation.valid) {
  return res
    .status(clinicIdValidation.status)
    .json({ error: clinicIdValidation.error })
}

const adminIdValidation = validateRequiredUuid(admin_id, 'admin_id')

if (!adminIdValidation.valid) {
  return res.status(400).json({ error: 'Valid admin_id is required' })
}

    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', admin_id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    if (!isAdminUser(adminUser)) {
      return res.status(403).json({ error: 'Only admins can update clinics' })
    }

    const hasAppointmentDuration = Object.prototype.hasOwnProperty.call(
      req.body,
      'appointment_duration_minutes'
    )

    const clinicUpdatePayload = {
      name,
      facility_type,
      services,
      operating_hours,
    }

    if (hasAppointmentDuration) {
      clinicUpdatePayload.appointment_duration_minutes = appointment_duration_minutes
    }

    const clinicValidation = validateClinicUpdatePayload(clinicUpdatePayload)

    if (!clinicValidation.valid) {
      return res.status(400).json({ error: clinicValidation.errors.join(', ') })
    }

    const updateData = {
      name,
      facility_type,
      operating_hours,
      services: normalizeServicesInput(services),
    }

    if (hasAppointmentDuration) {
      updateData.appointment_duration_minutes = appointment_duration_minutes
    }

    const { data, error } = await supabase
      .from('clinics')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    res.json({
      message: 'Clinic updated successfully',
      clinic: data,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update clinic' })
  }
})

// GET /api/queue/:clinicId/completed-count — retrieve completed count for a clinic
app.get('/api/queue/:clinicId/completed-count', async (req, res) => {
  try {
    const { clinicId } = req.params

    const idValidation = validateRequiredUuid(clinicId, 'clinic ID')

if (!idValidation.valid) {
  return res.status(idValidation.status).json({ error: idValidation.error })
}

    const { count, error } = await supabase
      .from('queue_entries')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'Complete')

    if (error) throw error

    res.json({ completedCount: count || 0 })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch completed count' })
  }
})

app.get('/api/users', async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, phone, email, role, clinic_id')
      .order('full_name', { ascending: true })

    if (usersError) throw usersError

    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, full_name, phone, email')
      .order('full_name', { ascending: true })

    if (patientsError) throw patientsError

    const registeredUsers = (users || []).map(user => ({
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      clinic_id: user.clinic_id,
      source: 'users',
    }))

   const registeredEmails = new Set((users || []).map(u => u.email).filter(Boolean))

const manualPatients = (patients || [])
  .filter(patient => !patient.linked_user_id && (!patient.email || !registeredEmails.has(patient.email)))
  .map(patient => ({
      id: patient.id,
      full_name: patient.full_name,
      phone: patient.phone,
      email: patient.email,
      role: 'Patient',
      clinic_id: null,
      source: 'patients',
    }))

    const combinedUsers = [...registeredUsers, ...manualPatients].sort((a, b) =>
      (a.full_name || '').localeCompare(b.full_name || '')
    )

    res.json({ users: combinedUsers })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})
//POST /api/queue/:clinicId/add-patient
app.post('/api/queue/:clinicId/add-patient', async (req, res) => {
  try {
    const { clinicId } = req.params
    const { patient_id } = req.body

    const idValidation = validateRequiredUuids({ clinicId, patient_id })

if (!idValidation.valid) {
  return res.status(400).json({ error: 'Invalid ID format' })
}

    // check patient not already in queue (same as join logic)
    const { data: activeQueues, error: activeError } = await supabase
      .from('queue_entries')
      .select('patient_id, status')
      .eq('patient_id', patient_id)
      .neq('status', 'Complete')

    if (activeError) throw activeError

    if (activeQueues.length > 0) {
      return res.status(409).json({
        error: 'Patient already has an active queue entry',
      })
    }

    const oldQueue = await tryFetchActiveQueueSnapshot(clinicId)

    // get next position
    const { data: queueData, error: queueError } = await supabase
      .from('queue_entries')
      .select('position')
      .eq('clinic_id', clinicId)
      .eq('status', 'Waiting')
      .order('position', { ascending: false })
      .limit(1)

    if (queueError) throw queueError

    const nextPosition =
      queueData.length > 0 ? queueData[0].position + 1 : 1

    // insert
    const { data: newEntry, error: insertError } = await supabase
      .from('queue_entries')
      .insert({
        clinic_id: clinicId,
        patient_id,
        position: nextPosition,
        status: 'Waiting',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    const queueNotifications =
      await triggerQueueNotificationsForClinicSafely(clinicId, oldQueue)

    res.status(201).json({
      entry: newEntry,
      queue_notifications: queueNotifications,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to add patient to queue' })
  }
})
const {
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput,
  validateAvailabilityWithinClinicHours,
} = require('./staffAvailabilityValidation')
// GET /api/staff/:staffId/availability — retrieve staff availability
app.get('/api/staff/:staffId/availability', async (req, res) => {
  try {
    const { staffId } = req.params
    const staffIdValidation = validateRequiredUuid(staffId, 'staff ID')

if (!staffIdValidation.valid) {
  return res
    .status(staffIdValidation.status)
    .json({ error: staffIdValidation.error })
}
    const { data, error } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .order('day_of_week', { ascending: true })
    if (error) throw error
    return res.status(200).json({ availability: data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch staff availability' })
  }
})

// POST /api/staff/:staffId/availability — create availability records
app.post('/api/staff/:staffId/availability', async (req, res) => {
  try {
    const { staffId } = req.params
    const { day_of_week, start_time, end_time, is_available } = req.body

    const validation = validateAvailabilityCreateInput({
      staffId,
      day_of_week,
      start_time,
      end_time,
    })

    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error })
    }

    const { data: staffUser, error: userError } = await supabase
      .from('users')
      .select('id, role, clinic_id')
      .eq('id', staffId)
      .maybeSingle()

    if (userError) throw userError
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found' })

    if (!['Staff', 'Admin'].includes(staffUser.role)) {
      return res.status(403).json({
        error: 'Only staff or admin can have availability records',
      })
    }

    if (!staffUser.clinic_id) {
      return res.status(400).json({
        error: 'Staff member is not assigned to a clinic',
      })
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('operating_hours')
      .eq('id', staffUser.clinic_id)
      .maybeSingle()

    if (clinicError) throw clinicError
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' })

    const clinicHoursValidation = validateAvailabilityWithinClinicHours({
      day_of_week,
      start_time,
      end_time,
      clinicOperatingHours: clinic.operating_hours,
    })

    if (!clinicHoursValidation.valid) {
      return res
        .status(clinicHoursValidation.status)
        .json({ error: clinicHoursValidation.error })
    }

    const { data: existing, error: existingError } = await supabase
      .from('staff_availability')
      .select('id')
      .eq('staff_id', staffId)
      .eq('day_of_week', day_of_week)
      .maybeSingle()

    if (existingError) throw existingError

    if (existing) {
      return res.status(409).json({
        error: 'Availability record already exists for this day',
      })
    }

    const { data, error } = await supabase
      .from('staff_availability')
      .insert({
        staff_id: staffId,
        day_of_week,
        start_time,
        end_time,
        is_available: is_available ?? true,
      })
      .select()
      .single()

    if (error) throw error

    return res.status(201).json({ availability: data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create availability record' })
  }
})

// PATCH /api/staff/:staffId/availability/:availabilityId — update existing availability
app.patch('/api/staff/:staffId/availability/:availabilityId', async (req, res) => {
  try {
    const { staffId, availabilityId } = req.params
    const { start_time, end_time, is_available } = req.body

    const validation = validateAvailabilityUpdateInput({
      staffId,
      availabilityId,
      start_time,
      end_time,
      is_available,
    })

    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('id', availabilityId)
      .eq('staff_id', staffId)
      .maybeSingle()

    if (fetchError) throw fetchError
    if (!existing) {
      return res.status(404).json({ error: 'Availability record not found' })
    }

    const nextStartTime = start_time || existing.start_time
    const nextEndTime = end_time || existing.end_time

    const { data: staffUser, error: staffError } = await supabase
      .from('users')
      .select('clinic_id')
      .eq('id', staffId)
      .maybeSingle()

    if (staffError) throw staffError

    if (!staffUser?.clinic_id) {
      return res.status(400).json({
        error: 'Staff member is not assigned to a clinic',
      })
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('operating_hours')
      .eq('id', staffUser.clinic_id)
      .maybeSingle()

    if (clinicError) throw clinicError
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' })

    const clinicHoursValidation = validateAvailabilityWithinClinicHours({
      day_of_week: existing.day_of_week,
      start_time: nextStartTime,
      end_time: nextEndTime,
      clinicOperatingHours: clinic.operating_hours,
    })

    if (!clinicHoursValidation.valid) {
      return res
        .status(clinicHoursValidation.status)
        .json({ error: clinicHoursValidation.error })
    }

    const updates = {}

    if (start_time) updates.start_time = start_time
    if (end_time) updates.end_time = end_time
    if (is_available !== undefined) updates.is_available = is_available

    const { data, error } = await supabase
      .from('staff_availability')
      .update(updates)
      .eq('id', availabilityId)
      .eq('staff_id', staffId)
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ availability: data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update availability record' })
  }
})

// POST /api/patients — staff creates a patient record for a walk-in

const { validatePatientInput } = require('./patientValidation')

// POST /api/patients — staff creates a patient record for a walk-in

app.post('/api/patients', async (req, res) => {
  let createdAuthUserId = null

  async function rollbackAuthUser() {
    if (!createdAuthUserId) return
    try {
      await supabase
        .from('users')
        .delete()
        .eq('id', createdAuthUserId)

      await supabase.auth.admin.deleteUser(createdAuthUserId)
    } catch (cleanupErr) {
      console.error('Failed to rollback auth user:', cleanupErr)
    }
  }

  try {
    const { full_name, phone, email, date_of_birth, created_by } = req.body

    const validation = validatePatientInput({ full_name, email, created_by })
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error })
    }

    const { data: staffUser, error: staffError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', created_by)
      .maybeSingle()

    if (staffError) throw staffError
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found' })
    if (!['Staff', 'Admin'].includes(staffUser.role)) {
      return res.status(403).json({ error: 'Only staff or admin can create patient records' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const { data: existingPatient, error: existingPatientError } = await supabase
      .from('patients')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingPatientError) throw existingPatientError
    if (existingPatient) {
      return res.status(409).json({ error: 'A patient with this email already exists' })
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingUserError) throw existingUserError
    if (existingUser) {
  return res.status(409).json({ 
    error: 'This patient is already registered in the system. Find them in the existing patients list instead.',
    user_id: existingUser.id
  })
}

// Check if email already exists in auth.users
const { data: authUsers, error: authLookupError } = await supabase.auth.admin.listUsers()
if (authLookupError) throw authLookupError

const authEmailExists = authUsers.users.some(u => u.email === normalizedEmail)
if (authEmailExists) {
  return res.status(409).json({ 
    error: 'This patient is already registered in the system. Find them in the existing patients list instead.'
  })
}
    // Create auth user so the patient ID works across all FK constraints
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    })

    if (authError) throw authError

    createdAuthUserId = authData.user.id

    // Insert into public.users with the same ID
    const { error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: createdAuthUserId,
        email: normalizedEmail,
        full_name: full_name.trim(),
        role: 'Patient',
      })

    if (userInsertError) {
      await rollbackAuthUser()
      throw userInsertError
    }

    // Insert into patients table with linked_user_id
    const { data, error } = await supabase
      .from('patients')
      .insert({
        full_name: full_name.trim(),
        phone: phone || null,
        email: normalizedEmail,
        date_of_birth: date_of_birth || null,
        created_by,
        linked_user_id: createdAuthUserId,
      })
      .select()
      .single()

    if (error) {
      await rollbackAuthUser()
      throw error
    }

    return res.status(201).json({ patient: { ...data, user_id: createdAuthUserId } })
  } catch (err) {
    console.error(err)
    await rollbackAuthUser()
    return res.status(500).json({ error: 'Failed to create patient record' })
  }
})

const {
  validateAppointmentBookingInput,
  validateStaffSelfBookingAvailabilityRule,
} = require('./appointmentBookingValidation')
app.get('/api/appointments/slots', async (req, res) => {
  try {
    const { clinic_id, date } = req.query

    const validation = validateSlotRetrievalInput({ clinic_id, date })
    if (!validation.valid) {
      return res.status(validation.status).json({ error: validation.error })
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinic_id)
      .maybeSingle()

    if (clinicError) throw clinicError
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' })
    }

    const schedule = resolveClinicSchedule(clinic)
    const dailySlots = generateDailySlots({
      date,
      operating_hours: schedule.operating_hours,
      appointment_duration_minutes: schedule.appointment_duration_minutes,
    })

    if (dailySlots.length === 0) {
      return res.json([])
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`)
    if (Number.isNaN(startOfDay.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' })
    }

    const startOfNextDay = new Date(startOfDay)
    startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1)

    const bookedTimes = await fetchBookedSlotTimes(
      clinic_id,
      startOfDay.toISOString(),
      startOfNextDay.toISOString()
    )
    const availableSlots = removeFullyBookedSlots(dailySlots, bookedTimes)

const slotValidation = validateGeneratedSlots(availableSlots, date)

if (!slotValidation.valid) {
  return res.status(slotValidation.status).json({ error: slotValidation.error })
}

return res.json(slotValidation.slots)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch appointment slots' })
  }
})

app.post('/api/appointments', async (req, res) => {
  let createdPatientId = null

 async function rollbackCreatedPatient() {
  if (!createdPatientId) return

  try {
    const { data: patientRows } = await supabase
      .from('patients')
      .select('id, linked_user_id')
      .or(`id.eq.${createdPatientId},linked_user_id.eq.${createdPatientId}`)
      .limit(1)

    const linkedUserId = patientRows?.[0]?.linked_user_id || null

    await supabase
      .from('patients')
      .delete()
      .or(`id.eq.${createdPatientId},linked_user_id.eq.${createdPatientId}`)

    if (linkedUserId) {
      await supabase
        .from('users')
        .delete()
        .eq('id', linkedUserId)

      await supabase.auth.admin.deleteUser(linkedUserId)
    }
  } catch (cleanupErr) {
    console.error('Failed to rollback patient:', cleanupErr)
  }
}

  try {
    const { clinic_id, patient_id, date, time, booked_by, is_new_patient } = req.body

    const inputValidation = validateAppointmentBookingInput({
      clinic_id,
      patient_id,
      date,
      time,
      booked_by,
    })

    if (!inputValidation.valid) {
      return res.status(inputValidation.status).json({
        error: inputValidation.error,
      })
    }

    if (is_new_patient) {
      createdPatientId = patient_id
    }

    /*const normalizedTime = getTimeFromAppointmentDatetime(time)
    const slot_datetime = new Date(`${date}T${normalizedTime}:00`)

    if (Number.isNaN(slot_datetime.getTime())) {
      await rollbackCreatedPatient()
      return res.status(400).json({ error: 'Invalid date or time format' })
    }*/
   //const normalizedTime = normalizeSlotTime(time)

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', clinic_id)
      .maybeSingle()

    if (clinicError) throw clinicError

    if (!clinic) {
      await rollbackCreatedPatient()
      return res.status(404).json({ error: 'Clinic not found' })
    }

    /*const schedule = resolveClinicSchedule(clinic)
    const validSlots = generateDailySlots({
      date,
      operating_hours: schedule.operating_hours,
      appointment_duration_minutes: schedule.appointment_duration_minutes,
    })

    if (!validSlots.includes(normalizedTime)) {
      await rollbackCreatedPatient()
      return res.status(400).json({
        error: 'Selected time is outside clinic hours or does not match the appointment duration',
      })
    }*/
    const schedule = resolveClinicSchedule(clinic)

const validSlots = generateDailySlots({
  date,
  operating_hours: schedule.operating_hours,
  appointment_duration_minutes: schedule.appointment_duration_minutes,
})

const selectedSlotValidation = validateSelectedSlot({
  date,
  time,
  validSlots,
})

if (!selectedSlotValidation.valid) {
  await rollbackCreatedPatient()
  return res
    .status(selectedSlotValidation.status)
    .json({ error: selectedSlotValidation.error })
}

const normalizedTime = selectedSlotValidation.normalizedTime
const slot_datetime = selectedSlotValidation.slotDateTime

    if (patient_id === booked_by) {
      const { data: bookedByUser, error: bookedByUserError } = await supabase
        .from('users')
        .select('id, role, clinic_id')
        .eq('id', booked_by)
        .maybeSingle()

      if (bookedByUserError) throw bookedByUserError

      if (
        bookedByUser &&
        ['Staff', 'Admin'].includes(bookedByUser.role) &&
        bookedByUser.clinic_id === clinic_id
      ) {
        const { data: staffUsers, error: staffUsersError } = await supabase
          .from('users')
          .select('id, role, clinic_id')
          .eq('clinic_id', clinic_id)
          .in('role', ['Staff', 'Admin'])

        if (staffUsersError) throw staffUsersError

        const staffIds = (staffUsers || []).map(staff => staff.id)
        let availabilityRows = []

        if (staffIds.length > 0) {
          const { data: availability, error: availabilityError } = await supabase
            .from('staff_availability')
            .select('staff_id, day_of_week, start_time, end_time, is_available')
            .in('staff_id', staffIds)

          if (availabilityError) throw availabilityError
          availabilityRows = availability || []
        }

        const selfBookingValidation = validateStaffSelfBookingAvailabilityRule({
          patient_id,
          booked_by,
          clinic_id,
          bookedByUser,
          staffUsers: staffUsers || [],
          availabilityRows,
          date,
          time: normalizedTime,
        })

        if (!selfBookingValidation.valid) {
          await rollbackCreatedPatient()
          return res.status(selfBookingValidation.status).json({
            error: selfBookingValidation.error,
          })
        }
      }
    }

    const slotRecord = await findOrCreateClinicSlot(
      clinic_id,
      slot_datetime.toISOString()
    )

    const staffCount = await fetchClinicBookingCapacity(clinic_id)

    const { data: existingAppointments, error: existingError } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', clinic_id)
      .eq('slot_id', slotRecord.id)
      .in('status', BOOKED_APPOINTMENT_STATUSES)

    if (existingError) throw existingError

    const bookedCount = Array.isArray(existingAppointments)
      ? existingAppointments.length
      : existingAppointments
        ? 1
        : 0

    if (bookedCount >= staffCount) {
      await rollbackCreatedPatient()
      return res.status(409).json({ error: 'This slot is already booked' })
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        clinic_id,
        patient_id,
        slot_id: slotRecord.id,
        status: 'Confirmed',
      })
      .select('*')
      .single()

    if (error) throw error

    // US-28-1/2/3/4: Send confirmation email after successful booking
const patientEmail = data.patient_email || null

// Fetch patient email and name if not on appointment record
let emailAddress = null
let patientName = null

const { data: patientUser } = await supabase
  .from('users')
  .select('email, full_name')
  .eq('id', patient_id)
  .maybeSingle()

if (patientUser) {
  emailAddress = patientUser.email
  patientName = patientUser.full_name
} else {
  const { data: patientRecord } = await supabase
    .from('patients')
    .select('email, full_name')
    .eq('id', patient_id)
    .maybeSingle()

  emailAddress = patientRecord?.email || null
  patientName = patientRecord?.full_name || null
}

// Fire and forget — email failure must not affect booking response
sendAppointmentConfirmationEmail({
  to: emailAddress,
  patientName,
  clinicName: clinic.name,
  date,
  time: normalizedTime || time,
}).catch(err => console.error('Email send failed silently:', err))

return res.status(201).json({
  message: 'Appointment booked successfully',
  appointment: data,
})

  } catch (err) {
    console.error(err)

    await rollbackCreatedPatient()

    return res.status(500).json({ error: 'Failed to create appointment' })
  }
})
//GET /api/appointments/patient/:patientId
app.get('/api/appointments/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params

    const idValidation = validateRequiredUuid(patientId, 'patient ID')

if (!idValidation.valid) {
  return res.status(idValidation.status).json({ error: idValidation.error })
}

    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, patient_id, clinic_id, slot_id, status, service')
      .eq('patient_id', patientId)

    if (appointmentError) throw appointmentError

    if (!appointments || appointments.length === 0) {
      return res.json({ appointments: [] })
    }

    const slotIds = [
      ...new Set(appointments.map((appointment) => appointment.slot_id).filter(Boolean)),
    ]

    const clinicIds = [
      ...new Set(appointments.map((appointment) => appointment.clinic_id).filter(Boolean)),
    ]

    let slotsById = {}

    if (slotIds.length > 0) {
      const { data: slots, error: slotError } = await supabase
        .from('slots')
        .select('id, slot_datetime')
        .in('id', slotIds)

      if (slotError) throw slotError

      slotsById = Object.fromEntries((slots || []).map((slot) => [slot.id, slot]))
    }

    let clinicsById = {}

    if (clinicIds.length > 0) {
      const { data: clinics, error: clinicError } = await supabase
        .from('clinics')
        .select('id, name')
        .in('id', clinicIds)

      if (clinicError) throw clinicError

      clinicsById = Object.fromEntries((clinics || []).map((clinic) => [clinic.id, clinic]))
    }

    const now = new Date()

  const allAppointments = appointments
    .map((appointment) => ({
      id: appointment.id,
      patient_id: appointment.patient_id,
      clinic_id: appointment.clinic_id,
      slot_id: appointment.slot_id,
      status: appointment.status || 'Confirmed',
      service: appointment.service || null,
      clinic_name: clinicsById[appointment.clinic_id]?.name || 'Clinic',
      slot_datetime: slotsById[appointment.slot_id]?.slot_datetime || null,
    }))
    .filter((appointment) => {
      if (!appointment.slot_datetime) return false
      return new Date(appointment.slot_datetime) >= now
    })
    .sort((a, b) => new Date(a.slot_datetime) - new Date(b.slot_datetime))

    res.json({ appointments: allAppointments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch patient appointments' })
  }
})
//GET /api/appointments/clinic/:clinicId
app.get('/api/appointments/clinic/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params
    const { date } = req.query

    const idValidation = validateRequiredUuid(clinicId, 'clinic ID')

if (!idValidation.valid) {
  return res.status(idValidation.status).json({ error: idValidation.error })
}

    if (!date) {
      return res.status(400).json({ error: 'Date is required' })
    }

    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, patient_id, clinic_id, slot_id, status, service')
      .eq('clinic_id', clinicId)

    if (appointmentError) throw appointmentError

    if (!appointments || appointments.length === 0) {
      return res.json({ appointments: [] })
    }

    const slotIds = [
      ...new Set(appointments.map(appointment => appointment.slot_id).filter(Boolean)),
    ]

    const patientIds = [
      ...new Set(appointments.map(appointment => appointment.patient_id).filter(Boolean)),
    ]

    let slotsById = {}

    if (slotIds.length > 0) {
      const { data: slots, error: slotError } = await supabase
        .from('slots')
        .select('id, slot_datetime')
        .in('id', slotIds)

      if (slotError) throw slotError

      slotsById = Object.fromEntries((slots || []).map(slot => [slot.id, slot]))
    }

    let usersById = {}

    if (patientIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', patientIds)

      if (usersError) throw usersError

      usersById = Object.fromEntries((users || []).map(user => [user.id, user]))
    }

    let patientsById = {}

    if (patientIds.length > 0) {
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id, full_name, email')
        .in('id', patientIds)

      if (patientsError) throw patientsError

      patientsById = Object.fromEntries((patients || []).map(patient => [patient.id, patient]))
    }

    const filteredAppointments = appointments
      .map(appointment => {
        const slotDatetime = slotsById[appointment.slot_id]?.slot_datetime || null
        const patient =
          usersById[appointment.patient_id] ||
          patientsById[appointment.patient_id] ||
          null

        return {
          id: appointment.id,
          patient_id: appointment.patient_id,
          clinic_id: appointment.clinic_id,
          slot_id: appointment.slot_id,
          status: appointment.status || 'Confirmed',
          service: appointment.service || null,
          slot_datetime: slotDatetime,
          patient,
        }
      })
      .filter(appointment => {
        if (!appointment.slot_datetime) return false
        return appointment.slot_datetime.slice(0, 10) === date
      })
      .sort((a, b) => new Date(a.slot_datetime) - new Date(b.slot_datetime))

    res.json({ appointments: filteredAppointments })
  } catch (err) {
    console.error('Failed to fetch clinic appointments:', err)
    res.status(500).json({ error: 'Failed to fetch clinic appointments' })
  }
})
const {
  BOOKED_APPOINTMENT_STATUSES,
  normalizeAppointmentStatus,
  canMarkAppointmentStatus,
  canRescheduleAppointment,
  canCancelAppointment,
} = require('./appointmentStatusValidation')
const {
  validateCancelRequest,
  validateAppointmentCanBeCancelled,
  buildCancelResponse,
} = require('./appointmentCancelValidation')

//PATCH /api/appointments/:id/status
app.patch('/api/appointments/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const idValidation = validateRequiredUuid(id, 'appointment ID')

    if (!idValidation.valid) {
      return res.status(idValidation.status).json({ error: idValidation.error })
    }

    const normalizedStatus = normalizeAppointmentStatus(status)

    if (!['Completed', 'No-show'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid appointment status' })
    }

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const statusValidation = canMarkAppointmentStatus(
      appointment.status,
      normalizedStatus
    )

    if (!statusValidation.valid) {
      return res
        .status(statusValidation.status)
        .json({ error: statusValidation.error })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: normalizedStatus })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return res.json({
      message: `Appointment marked as ${normalizedStatus}`,
      appointment: data,
    })
  } catch (err) {
    console.error('Failed to update appointment status:', err)
    return res.status(500).json({ error: 'Failed to update appointment status' })
  }
})
const {
  validateRescheduleRequest,
  canUseRescheduleSlot,
  buildRescheduleResponse,
} = require('./appointmentRescheduleValidation')

//PATCH /api/appointments/:id/reschedule
app.patch('/api/appointments/:id/reschedule', async (req, res) => {
  try {
    const { id } = req.params
    const { date, time } = req.body

    const idValidation = validateRequiredUuid(id, 'appointment ID')

if (!idValidation.valid) {
  return res.status(idValidation.status).json({ error: idValidation.error })
}

    const requestValidation = validateRescheduleRequest({
  appointmentId: id,
  date,
  time,
})

if (!requestValidation.valid) {
  return res
    .status(requestValidation.status)
    .json({ error: requestValidation.error })
}

const requestedTime = requestValidation.normalizedTime

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, clinic_id, patient_id, slot_id, status')
      .eq('id', id)
      .maybeSingle()

    if (appointmentError) throw appointmentError

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    const rescheduleValidation = canRescheduleAppointment(appointment.status)

if (!rescheduleValidation.valid) {
  return res
    .status(rescheduleValidation.status)
    .json({ error: rescheduleValidation.error })
}

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', appointment.clinic_id)
      .maybeSingle()

    if (clinicError) throw clinicError

    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' })
    }

    const schedule = resolveClinicSchedule(clinic)

    const validSlots = generateDailySlots({
      date,
      operating_hours: schedule.operating_hours,
      appointment_duration_minutes: schedule.appointment_duration_minutes,
    })

    const selectedSlotValidation = validateSelectedSlot({
      date,
      time: requestedTime,
      validSlots,
    })

    if (!selectedSlotValidation.valid) {
      return res
        .status(selectedSlotValidation.status)
        .json({ error: selectedSlotValidation.error })
    }

    const oldSlotId = appointment.slot_id
    const slotDatetime = selectedSlotValidation.slotDateTime

    const newSlot = await findOrCreateClinicSlot(
      appointment.clinic_id,
      slotDatetime.toISOString()
    )

    const staffCount = await fetchClinicBookingCapacity(appointment.clinic_id)

    const { data: existingAppointments, error: existingError } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', appointment.clinic_id)
      .eq('slot_id', newSlot.id)
      .in('status', BOOKED_APPOINTMENT_STATUSES)
      .neq('id', appointment.id)

    if (existingError) throw existingError

    const slotCapacityValidation = canUseRescheduleSlot({
  existingAppointments,
  staffCount,
})

if (!slotCapacityValidation.valid) {
  return res
    .status(slotCapacityValidation.status)
    .json({ error: slotCapacityValidation.error })
}

    const { data, error } = await supabase
      .from('appointments')
      .update({
        slot_id: newSlot.id,
        status: 'Confirmed',
      })
      .eq('id', appointment.id)
      .select('*')
      .single()

    if (error) throw error

    await refreshSlotAvailability({
      clinicId: appointment.clinic_id,
      slotId: oldSlotId,
      capacity: staffCount,
    })

    if (newSlot.id !== oldSlotId) {
      await refreshSlotAvailability({
        clinicId: appointment.clinic_id,
        slotId: newSlot.id,
        capacity: staffCount,
      })
    }

    return res.json(
  buildRescheduleResponse({
    appointment,
    updatedAppointment: data,
    oldSlotId,
    newSlot,
  })
)
  } catch (err) {
    console.error('Failed to reschedule appointment:', err)
    return res.status(500).json({ error: 'Failed to reschedule appointment' })
  }
})

//PATCH /api/appointments/:id/cancel
app.patch('/api/appointments/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params

    const requestValidation = validateCancelRequest({
      appointmentId: id,
    })

    if (!requestValidation.valid) {
      return res
        .status(requestValidation.status)
        .json({ error: requestValidation.error })
    }

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id, clinic_id, slot_id, status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) throw fetchError

    const cancelValidation = validateAppointmentCanBeCancelled(appointment)

    if (!cancelValidation.valid) {
      return res
        .status(cancelValidation.status)
        .json({ error: cancelValidation.error })
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'Cancelled' })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    const staffCount = await fetchClinicBookingCapacity(appointment.clinic_id)

    await refreshSlotAvailability({
      clinicId: appointment.clinic_id,
      slotId: appointment.slot_id,
      capacity: staffCount,
    })

    return res.json(
      buildCancelResponse({
        appointment: data,
      })
    )
  } catch (err) {
    console.error('Failed to cancel appointment:', err)
    return res.status(500).json({ error: 'Failed to cancel appointment' })
  }
})

// Serve built frontend
const publicPath = path.join(__dirname, '..', 'public')
app.use(express.static(publicPath))

// React catch-all — must come LAST, after all API routes
app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'))
})

module.exports = app

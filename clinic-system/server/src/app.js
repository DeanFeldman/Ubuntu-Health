const express = require('express')
const cors = require('cors')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const app = express()
const {
  checkAndTriggerNotifications,
  configureQueueNotificationService,
} = require('./queueNotificationService')

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

    const { data, error } = await query

    if (error) throw error

    res.json({ clinics: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinics' })
  }
})

// GET /api/clinics/:id
app.get('/api/clinics/:id', async (req, res) => {
  try {
    const { id } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
    }

    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Clinic not found' })

    res.json({ clinic: data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch clinic' })
  }
})

// GET /api/queue/:clinicId — retrieve full queue for a clinic for staff only
app.get('/api/queue/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
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


// GET /api/queue/:clinicId/position/:patientId — retrieve a patient's position in the queue
app.get('/api/queue/:clinicId/position/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }

    const { data, error } = await supabase
      .from('queue_entries')
      .select('position')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'Waiting')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'No active queue entry found for this patient' })

    res.json({ position: data.position })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch queue position' })
  }
})

// GET /api/queue/:clinicId/entry/:patientId — retrieve a patient's full active queue entry
app.get('/api/queue/:clinicId/entry/:patientId', async (req, res) => {
  try {
    const { clinicId, patientId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
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

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    if (!uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' })
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patientId)) {
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

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid request ID format' })
    }

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    if (!uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' })
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

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid request ID format' })
    }

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    if (!uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' })
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
const { validateQueueJoin } = require('./queueValidation')

app.post('/api/queue/:clinicId/join', async (req, res) => {
  try {
    const { clinicId } = req.params
    const { patient_id, confirmed } = req.body

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patient_id)) {
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

    res.status(201).json({ entry: newEntry, queue_notifications: queueNotifications })
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(entryId)) {
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

    // Insert notification for the patient on status change
    const notificationMessages = {
      'Called': 'You are being called — please make your way to the consultation room.',
      'Complete': 'Your visit is complete. Thank you for using Ubuntu Health.'
    }

    if (notificationMessages[status]) {
      await supabase
        .from('notifications')
        .insert({
          user_id: updatedEntry.patient_id,
          type: 'queue_alert',
          channel: 'push',
          message: notificationMessages[status],
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(entryId)) {
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID format' })
    }

    if (queue_entry_id && !uuidRegex.test(queue_entry_id)) {
      return res.status(400).json({ error: 'Invalid queue entry ID format' })
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

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    const uuidRegex = /^[0-9a-f-]{36}$/i
    if (!uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid admin ID format' })
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

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    const uuidRegex = /^[0-9a-f-]{36}$/i
    if (!uuidRegex.test(id) || !uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid request or admin ID format' })
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

    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' })
    }

    const uuidRegex = /^[0-9a-f-]{36}$/i
    if (!uuidRegex.test(id) || !uuidRegex.test(admin_id)) {
      return res.status(400).json({ error: 'Invalid request or admin ID format' })
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


// PATCH /api/users/:userId/assign-clinic — admin assigns a staff member to a clinic
app.patch('/api/users/:userId/assign-clinic', async (req, res) => {
  try {
    const { userId } = req.params
    const { admin_id, clinic_id } = req.body

    const uuidRegex = /^[0-9a-f-]{36}$/i

    if (!uuidRegex.test(userId) || !uuidRegex.test(admin_id) || !uuidRegex.test(clinic_id)) {
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

    if (admin.role !== 'Admin') {
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

    const normalizedRole = selectedUser.role?.trim().toLowerCase()

    if (!normalizedRole || !normalizedRole.includes('staff')) {
      return res.status(400).json({ error: 'Selected user is not staff' })
    }

    if (selectedUser.clinic_id && selectedUser.clinic_id !== clinic_id) {
      return res.status(409).json({ error: 'Staff member is already assigned to another clinic' })
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

    const uuidRegex = /^[0-9a-f-]{36}$/i

    if (!uuidRegex.test(userId) || !uuidRegex.test(admin_id)) {
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

    if (admin.role !== 'Admin') {
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

    const normalizedRole = selectedUser.role?.trim().toLowerCase()

    if (!normalizedRole || !normalizedRole.includes('staff')) {
      return res.status(400).json({ error: 'Selected user is not staff' })
    }

    if (!selectedUser.clinic_id) {
      return res.status(400).json({ error: 'Staff member is not assigned to a clinic' })
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

// GET /api/queue/:clinicId/completed-count — retrieve completed count for a clinic
app.get('/api/queue/:clinicId/completed-count', async (req, res) => {
  try {
    const { clinicId } = req.params

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clinicId)) {
      return res.status(400).json({ error: 'Invalid clinic ID format' })
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
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, phone, role, clinic_id')
      .order('full_name', { ascending: true })

    if (error) throw error

    res.json({ users: data || [] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})


app.post('/api/queue/:clinicId/add-patient', async (req, res) => {
  try {
    const { clinicId } = req.params
    const { patient_id } = req.body

    const uuidRegex = /^[0-9a-f-]{36}$/i
    if (!uuidRegex.test(clinicId) || !uuidRegex.test(patient_id)) {
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

// GET /api/staff/:staffId/availability — retrieve staff availability
app.get('/api/staff/:staffId/availability', async (req, res) => {
  try {
    const { staffId } = req.params
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID format' })
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(staffId)) {
      return res.status(400).json({ error: 'Invalid staff ID format' })
    }
    if (day_of_week === undefined || day_of_week === null) {
      return res.status(400).json({ error: 'day_of_week is required' })
    }
    if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'day_of_week must be an integer between 0 and 6' })
    }
    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'start_time and end_time are required' })
    }
    if (start_time >= end_time) {
      return res.status(400).json({ error: 'start_time must be before end_time' })
    }
    const { data: staffUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', staffId)
      .maybeSingle()
    if (userError) throw userError
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found' })
    if (!['Staff', 'Admin'].includes(staffUser.role)) {
      return res.status(403).json({ error: 'Only staff or admin can have availability records' })
    }
    const { data: existing, error: existingError } = await supabase
      .from('staff_availability')
      .select('id')
      .eq('staff_id', staffId)
      .eq('day_of_week', day_of_week)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      return res.status(409).json({ error: 'Availability record already exists for this day' })
    }
    const { data, error } = await supabase
      .from('staff_availability')
      .insert({ staff_id: staffId, day_of_week, start_time, end_time, is_available: is_available ?? true })
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(staffId) || !uuidRegex.test(availabilityId)) {
      return res.status(400).json({ error: 'Invalid ID format' })
    }
    if (!start_time && !end_time && is_available === undefined) {
      return res.status(400).json({ error: 'At least one field must be provided to update' })
    }
    if (start_time && end_time && start_time >= end_time) {
      return res.status(400).json({ error: 'start_time must be before end_time' })
    }
    const { data: existing, error: fetchError } = await supabase
      .from('staff_availability')
      .select('*')
      .eq('id', availabilityId)
      .eq('staff_id', staffId)
      .maybeSingle()
    if (fetchError) throw fetchError
    if (!existing) return res.status(404).json({ error: 'Availability record not found' })
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
app.post('/api/patients', async (req, res) => {
  try {
    const { full_name, phone, email, date_of_birth, created_by } = req.body
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!full_name || full_name.trim() === '') {
      return res.status(400).json({ error: 'full_name is required' })
    }
    if (!created_by) {
      return res.status(400).json({ error: 'created_by is required' })
    }
    if (!uuidRegex.test(created_by)) {
      return res.status(400).json({ error: 'Invalid created_by ID format' })
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
    const { data, error } = await supabase
      .from('patients')
      .insert({
        full_name: full_name.trim(),
        phone: phone || null,
        email: email || null,
        date_of_birth: date_of_birth || null,
        created_by,
      })
      .select()
      .single()
    if (error) throw error
    return res.status(201).json({ patient: data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create patient record' })
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

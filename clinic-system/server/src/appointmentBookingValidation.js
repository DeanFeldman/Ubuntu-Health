const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

function hasRequiredAppointmentFields({ clinic_id, patient_id, date, time, booked_by }) {
  return Boolean(clinic_id && patient_id && date && time && booked_by)
}

function validateAppointmentBookingInput({ clinic_id, patient_id, date, time, booked_by }) {
  if (!hasRequiredAppointmentFields({ clinic_id, patient_id, date, time, booked_by })) {
    return {
      valid: false,
      status: 400,
      error: 'clinic_id, patient_id, date, time and booked_by are required',
    }
  }

  if (!isValidUuid(clinic_id) || !isValidUuid(patient_id) || !isValidUuid(booked_by)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid ID format',
    }
  }

  if (!isValidDateString(date)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid date format',
    }
  }

  if (!isValidTimeString(time)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid time format',
    }
  }

  return {
    valid: true,
    status: 200,
    error: null,
  }
}

function isValidDateString(date) {
  if (typeof date !== 'string') return false

  const match = date.match(/^\d{4}-\d{2}-\d{2}$/)
  if (!match) return false

  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return false

  return parsed.toISOString().slice(0, 10) === date
}

function isValidTimeString(time) {
  if (typeof time !== 'string') return false

  const normalized = normalizeTimeValue(time)
  if (!normalized) return false

  const [hours, minutes] = normalized.split(':').map(Number)

  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  )
}

function normalizeTimeValue(time) {
  if (!time) return null

  if (typeof time !== 'string') return null

  const trimmed = time.trim()
  const match = trimmed.match(/(\d{2}):(\d{2})/)

  if (!match) return null

  return `${match[1]}:${match[2]}`
}

function getDayOfWeekFromDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) return null

  return parsed.getUTCDay()
}

function timeToMinutes(time) {
  const normalized = normalizeTimeValue(time)

  if (!normalized) return null

  const [hours, minutes] = normalized.split(':').map(Number)

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return hours * 60 + minutes
}

function isTimeWithinAvailability({ time, start_time, end_time }) {
  const appointmentMinutes = timeToMinutes(time)
  const startMinutes = timeToMinutes(start_time)
  const endMinutes = timeToMinutes(end_time)

  if (
    appointmentMinutes === null ||
    startMinutes === null ||
    endMinutes === null
  ) {
    return false
  }

  return appointmentMinutes >= startMinutes && appointmentMinutes < endMinutes
}

function isStaffUser(user) {
  return Boolean(user && ['Staff', 'Admin'].includes(user.role))
}

function isSelfBooking({ patient_id, booked_by }) {
  return Boolean(patient_id && booked_by && patient_id === booked_by)
}

function isBookingAtOwnClinic({ user, clinic_id }) {
  return Boolean(user && user.clinic_id && user.clinic_id === clinic_id)
}

function getAvailableStaffAtTime({ staffUsers = [], availabilityRows = [], clinic_id, date, time }) {
  const dayOfWeek = getDayOfWeekFromDate(date)

  if (dayOfWeek === null) return []

  const eligibleStaffIds = new Set(
    staffUsers
      .filter(user => isStaffUser(user))
      .filter(user => user.clinic_id === clinic_id)
      .map(user => user.id)
  )

  return availabilityRows.filter(row => {
    if (!row || !eligibleStaffIds.has(row.staff_id)) return false
    if (row.day_of_week !== dayOfWeek) return false
    if (row.is_available === false) return false

    return isTimeWithinAvailability({
      time,
      start_time: row.start_time,
      end_time: row.end_time,
    })
  })
}

function validateStaffSelfBookingAvailabilityRule({
  patient_id,
  booked_by,
  clinic_id,
  bookedByUser,
  staffUsers = [],
  availabilityRows = [],
  date,
  time,
}) {
  if (!isSelfBooking({ patient_id, booked_by })) {
    return {
      valid: true,
      status: 200,
      error: null,
    }
  }

  if (!isStaffUser(bookedByUser)) {
    return {
      valid: true,
      status: 200,
      error: null,
    }
  }

  if (!isBookingAtOwnClinic({ user: bookedByUser, clinic_id })) {
    return {
      valid: true,
      status: 200,
      error: null,
    }
  }

  const availableStaff = getAvailableStaffAtTime({
    staffUsers,
    availabilityRows,
    clinic_id,
    date,
    time,
  })

  if (availableStaff.length <= 1) {
    return {
      valid: false,
      status: 409,
      error:
        'Staff cannot book themselves when they are the only available staff member at this clinic and time',
    }
  }

  return {
    valid: true,
    status: 200,
    error: null,
  }
}

const ALLOWED_STATUS_VALUES = ['Completed', 'No-show', 'Cancelled']

function validateAppointmentStatusUpdate({ appointment_id, status }) {
  if (!appointment_id || !status) {
    return {
      valid: false,
      status: 400,
      error: 'appointment_id and status are required',
    }
  }

  if (!isValidUuid(appointment_id)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid appointment_id format',
    }
  }

  if (!ALLOWED_STATUS_VALUES.includes(status)) {
    return {
      valid: false,
      status: 400,
      error: `Invalid status. Allowed values: ${ALLOWED_STATUS_VALUES.join(', ')}`,
    }
  }

  return {
    valid: true,
    status: 200,
    error: null,
  }
}

module.exports = {
  isValidUuid,
  hasRequiredAppointmentFields,
  validateAppointmentBookingInput,
  isValidDateString,
  isValidTimeString,
  normalizeTimeValue,
  getDayOfWeekFromDate,
  timeToMinutes,
  isTimeWithinAvailability,
  isStaffUser,
  isSelfBooking,
  isBookingAtOwnClinic,
  getAvailableStaffAtTime,
  validateStaffSelfBookingAvailabilityRule,
  validateAppointmentStatusUpdate,
}
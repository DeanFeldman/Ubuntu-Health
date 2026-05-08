const APPOINTMENT_STATUSES = [
  'Confirmed',
  'Waiting',
  'Completed',
  'Cancelled',
  'No-show',
]

const BOOKED_APPOINTMENT_STATUSES = ['Confirmed', 'Waiting']

function normalizeAppointmentStatus(status) {
  if (!status) return 'Confirmed'

  const normalized = String(status).trim()

  const legacyStatusMap = {
    Pending: 'Confirmed',
    Rescheduled: 'Confirmed',
    Complete: 'Completed',
    NoShow: 'No-show',
    No_Show: 'No-show',
    'No-show': 'No-show',
  }

  return legacyStatusMap[normalized] || normalized
}

function isValidAppointmentStatus(status) {
  return APPOINTMENT_STATUSES.includes(status)
}

function isFinalAppointmentStatus(status) {
  return ['Cancelled', 'Completed', 'No-show'].includes(status)
}

function canMarkAppointmentStatus(currentStatus, nextStatus, appointmentDateTime = null) {
  const normalizedStatus = normalizeAppointmentStatus(nextStatus)

  if (!['Completed', 'No-show'].includes(normalizedStatus)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid appointment status',
    }
  }

  if (isFinalAppointmentStatus(currentStatus)) {
    return {
      valid: false,
      status: 409,
      error: `Appointment is already ${currentStatus}`,
    }
  }

  if (normalizedStatus === 'No-show' && appointmentDateTime) {
    const appointmentTime = new Date(appointmentDateTime)

    if (!Number.isNaN(appointmentTime.getTime()) && appointmentTime > new Date()) {
      return {
        valid: false,
        status: 409,
        error: 'Cannot mark a future appointment as No-show',
      }
    }
  }

  return {
    valid: true,
    normalizedStatus,
  }
}

function canRescheduleAppointment(currentStatus) {
  if (isFinalAppointmentStatus(currentStatus)) {
    return {
      valid: false,
      status: 409,
      error: `Cannot reschedule an appointment that is ${currentStatus}`,
    }
  }

  return { valid: true }
}

function canCancelAppointment(currentStatus) {
  if (currentStatus === 'Cancelled') {
    return {
      valid: false,
      status: 409,
      error: 'Appointment is already cancelled',
    }
  }

  if (['Completed', 'No-show'].includes(currentStatus)) {
    return {
      valid: false,
      status: 409,
      error: `Cannot cancel an appointment that is ${currentStatus}`,
    }
  }

  return { valid: true }
}

module.exports = {
  APPOINTMENT_STATUSES,
  BOOKED_APPOINTMENT_STATUSES,
  normalizeAppointmentStatus,
  isValidAppointmentStatus,
  isFinalAppointmentStatus,
  canMarkAppointmentStatus,
  canRescheduleAppointment,
  canCancelAppointment,
}
const {
  isValidDateFormat,
  normalizeSlotTime,
} = require('./appointmentSlotValidation')

function validateRescheduleRequest({ appointmentId, date, time }) {
  if (!appointmentId) {
    return {
      valid: false,
      status: 400,
      error: 'appointment ID is required',
    }
  }

  if (!date) {
    return {
      valid: false,
      status: 400,
      error: 'date is required',
    }
  }

  if (!time) {
    return {
      valid: false,
      status: 400,
      error: 'time is required',
    }
  }

  if (!isValidDateFormat(date)) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid date format',
    }
  }

  const normalizedTime = normalizeSlotTime(time)

  if (!normalizedTime) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid time format',
    }
  }

  return {
    valid: true,
    normalizedTime,
  }
}

function canUseRescheduleSlot({ existingAppointments, staffCount }) {
  const bookedCount = Array.isArray(existingAppointments)
    ? existingAppointments.length
    : existingAppointments
      ? 1
      : 0

  const capacity = Number(staffCount)

  const safeCapacity =
    Number.isFinite(capacity) && capacity > 0
      ? capacity
      : 1

  if (bookedCount >= safeCapacity) {
    return {
      valid: false,
      status: 409,
      error: 'This slot is already booked',
    }
  }

  return {
    valid: true,
    bookedCount,
    capacity: safeCapacity,
  }
}

function buildRescheduleResponse({ appointment, updatedAppointment, oldSlotId, newSlot }) {
  return {
    success: true,
    message: 'Appointment rescheduled successfully',
    appointment: {
      ...updatedAppointment,
      slot_datetime: newSlot.slot_datetime,
    },
    old_slot_id: oldSlotId,
    new_slot_id: newSlot.id,
  }
}

module.exports = {
  validateRescheduleRequest,
  canUseRescheduleSlot,
  buildRescheduleResponse,
}
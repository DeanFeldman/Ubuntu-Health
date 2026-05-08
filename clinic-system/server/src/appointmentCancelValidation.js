const { validateRequiredUuid } = require('./commonValidation')
const { canCancelAppointment } = require('./appointmentStatusValidation')

function validateCancelRequest({ appointmentId }) {
  const idValidation = validateRequiredUuid(appointmentId, 'appointment ID')

  if (!idValidation.valid) {
    return {
      valid: false,
      status: idValidation.status,
      error: idValidation.error,
    }
  }

  return { valid: true }
}

function validateAppointmentCanBeCancelled(appointment) {
  if (!appointment) {
    return {
      valid: false,
      status: 404,
      error: 'Appointment not found',
    }
  }

  return canCancelAppointment(appointment.status)
}

function buildCancelResponse({ appointment }) {
  return {
    message: 'Appointment cancelled successfully',
    appointment,
  }
}

module.exports = {
  validateCancelRequest,
  validateAppointmentCanBeCancelled,
  buildCancelResponse,
}
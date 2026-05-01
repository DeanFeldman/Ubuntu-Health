function isValidUuid(value) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePatientInput({ full_name, email, created_by }) {
  if (!full_name || full_name.trim() === '') {
    return { valid: false, status: 400, error: 'full_name is required' }
  }

  if (!email || email.trim() === '') {
    return { valid: false, status: 400, error: 'email is required' }
  }

  if (!isValidEmail(email.trim())) {
    return { valid: false, status: 400, error: 'Invalid email format' }
  }

  if (!created_by) {
    return { valid: false, status: 400, error: 'created_by is required' }
  }

  if (!isValidUuid(created_by)) {
    return { valid: false, status: 400, error: 'Invalid created_by ID format' }
  }

  return { valid: true }
}


function calculateEstimatedWaitTime({
  patientsAhead,
  appointmentDuration,
  staffCount,
}) {
  if (!staffCount || staffCount <= 0) {
    return {
      estimatedWaitTime: null,
      message: 'Estimate not available',
    }
  }

  const safePatientsAhead = Math.max(Number(patientsAhead) || 0, 0)

  const safeAppointmentDuration =
    Number(appointmentDuration) > 0 ? Number(appointmentDuration) : 15

  return {
    estimatedWaitTime: Math.ceil(
      (safePatientsAhead * safeAppointmentDuration) / staffCount
    ),
  }
}

module.exports = {
  isValidUuid,
  isValidEmail,
  validatePatientInput,
  calculateEstimatedWaitTime,
}
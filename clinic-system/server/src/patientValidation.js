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

module.exports = {
  isValidUuid,
  isValidEmail,
  validatePatientInput,
}
function isValidUuid(value) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  return typeof value === 'string' && uuidRegex.test(value)
}

function validateRequiredUuid(value, fieldName) {
  if (!value) {
    return {
      valid: false,
      status: 400,
      error: `${fieldName} is required`,
    }
  }

  if (!isValidUuid(value)) {
    return {
      valid: false,
      status: 400,
      error: `Invalid ${fieldName} format`,
    }
  }

  return { valid: true }
}

function validateRequiredUuids(fields) {
  for (const [fieldName, value] of Object.entries(fields)) {
    const result = validateRequiredUuid(value, fieldName)

    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}

module.exports = {
  isValidUuid,
  validateRequiredUuid,
  validateRequiredUuids,
}
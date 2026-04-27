function isValidUuid(value) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  return uuidRegex.test(value)
}

function isValidDateFormat(date) {
  if (!date || typeof date !== 'string') return false

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(date)) return false

  const parsedDate = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(parsedDate.getTime())
}

function isPastDate(date) {
  const today = new Date().toISOString().split('T')[0]
  return date < today
}

function validateSlotRetrievalInput({ clinic_id, date }) {
  if (!clinic_id) {
    return { valid: false, status: 400, error: 'clinic_id is required' }
  }

  if (!date) {
    return { valid: false, status: 400, error: 'date is required' }
  }

  if (!isValidUuid(clinic_id)) {
    return { valid: false, status: 400, error: 'Invalid clinic ID format' }
  }

  if (!isValidDateFormat(date)) {
    return { valid: false, status: 400, error: 'Invalid date format' }
  }

  if (isPastDate(date)) {
    return { valid: false, status: 400, error: 'Past dates cannot be used for slot retrieval' }
  }

  return { valid: true }
}
function sanitizeGeneratedSlots(slots, date) {
  if (!Array.isArray(slots)) return []

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date()

  return [...new Set(slots)]
    .filter(slot => typeof slot === 'string')
    .filter(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot))
    .filter(slot => {
      if (date !== today) return true
      return new Date(`${date}T${slot}:00`) >= now
    })
    .sort()
}

module.exports = {
  isValidUuid,
  isValidDateFormat,
  isPastDate,
  validateSlotRetrievalInput,
  sanitizeGeneratedSlots,
}
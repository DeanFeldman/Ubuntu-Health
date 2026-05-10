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
  if (Number.isNaN(parsedDate.getTime())) return false

  return parsedDate.toISOString().slice(0, 10) === date
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
function normalizeSlotTime(time) {
  if (!time) return null

  if (typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return time
  }

  const parsedDate = new Date(time)
  if (Number.isNaN(parsedDate.getTime())) return null

  return parsedDate.toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function validateGeneratedSlots(slots, date) {
  if (!Array.isArray(slots)) {
    return {
      valid: false,
      status: 500,
      error: 'Generated slots must be an array',
    }
  }

  const sanitizedSlots = sanitizeGeneratedSlots(slots, date)

  if (sanitizedSlots.length !== new Set(sanitizedSlots).size) {
    return {
      valid: false,
      status: 500,
      error: 'Generated slots contain duplicates',
    }
  }

  return {
    valid: true,
    slots: sanitizedSlots,
  }
}

function validateSelectedSlot({ date, time, validSlots }) {
  const normalizedTime = normalizeSlotTime(time)

  if (!normalizedTime) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid date or time format',
    }
  }

  const slotDateTime = new Date(`${date}T${normalizedTime}:00`)

  if (Number.isNaN(slotDateTime.getTime())) {
    return {
      valid: false,
      status: 400,
      error: 'Invalid date or time format',
    }
  }

  if (slotDateTime < new Date()) {
    return {
      valid: false,
      status: 400,
      error: 'Cannot book a past time slot',
    }
  }

  if (!Array.isArray(validSlots) || !validSlots.includes(normalizedTime)) {
    return {
      valid: false,
      status: 400,
      error: 'Selected time is outside clinic hours or does not match the appointment duration',
    }
  }

  return {
    valid: true,
    normalizedTime,
    slotDateTime,
  }
}

function removeFullyBookedSlots(generatedSlots, bookedTimes) {
  const bookedSet = bookedTimes instanceof Set ? bookedTimes : new Set(bookedTimes || [])
  return generatedSlots.filter(slot => !bookedSet.has(slot))
}
function validateClinicBookingCapacity(staffCount) {
  const parsedStaffCount = Number(staffCount)

  if (!Number.isFinite(parsedStaffCount) || parsedStaffCount <= 0) {
    return {
      valid: false,
      status: 409,
      reason: 'NO_STAFF',
      error: 'Appointments are not currently available for this clinic',
    }
  }

  return {
    valid: true,
    capacity: parsedStaffCount,
  }
}
module.exports = {
  isValidUuid,
  isValidDateFormat,
  isPastDate,
  validateSlotRetrievalInput,
  sanitizeGeneratedSlots,
  normalizeSlotTime,
  validateGeneratedSlots,
  validateSelectedSlot,
  removeFullyBookedSlots,
  validateClinicBookingCapacity,
}

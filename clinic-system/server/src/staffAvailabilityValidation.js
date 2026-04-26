function isValidUuid(value) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  return uuidRegex.test(value)
}

function getDayName(dayOfWeek) {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  return days[dayOfWeek]
}

function validateAvailabilityWithinClinicHours({
  day_of_week,
  start_time,
  end_time,
  clinicOperatingHours,
}) {
  const dayName = getDayName(day_of_week)
  const clinicHours = clinicOperatingHours?.[dayName]

  if (!clinicHours || !clinicHours.open || !clinicHours.close) {
    return {
      valid: false,
      status: 400,
      error: 'Clinic is closed on this day',
    }
  }

  if (start_time < clinicHours.open || end_time > clinicHours.close) {
    return {
      valid: false,
      status: 400,
      error: 'Availability must be within clinic operating hours',
    }
  }

  return { valid: true }
}

function validateAvailabilityCreateInput({ staffId, day_of_week, start_time, end_time }) {
  if (!isValidUuid(staffId)) {
    return { valid: false, status: 400, error: 'Invalid staff ID format' }
  }

  if (day_of_week === undefined || day_of_week === null) {
    return { valid: false, status: 400, error: 'day_of_week is required' }
  }

  if (!Number.isInteger(day_of_week) || day_of_week < 0 || day_of_week > 6) {
    return {
      valid: false,
      status: 400,
      error: 'day_of_week must be an integer between 0 and 6',
    }
  }

  if (!start_time || !end_time) {
    return { valid: false, status: 400, error: 'start_time and end_time are required' }
  }

  if (start_time >= end_time) {
    return { valid: false, status: 400, error: 'start_time must be before end_time' }
  }

  return { valid: true }
}

function validateAvailabilityUpdateInput({ staffId, availabilityId, start_time, end_time, is_available }) {
  if (!isValidUuid(staffId) || !isValidUuid(availabilityId)) {
    return { valid: false, status: 400, error: 'Invalid ID format' }
  }

  if (!start_time && !end_time && is_available === undefined) {
    return {
      valid: false,
      status: 400,
      error: 'At least one field must be provided to update',
    }
  }

  if (start_time && end_time && start_time >= end_time) {
    return { valid: false, status: 400, error: 'start_time must be before end_time' }
  }

  return { valid: true }
}

module.exports = {
  isValidUuid,
  getDayName,
  validateAvailabilityWithinClinicHours,
  validateAvailabilityCreateInput,
  validateAvailabilityUpdateInput,
}
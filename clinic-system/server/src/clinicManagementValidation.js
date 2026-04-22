const VALID_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function isValidUuid(value) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return typeof value === 'string' && uuidRegex.test(value)
}

function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : ''
}

function isAdminUser(user) {
  return !!user && normalizeRole(user.role) === 'admin'
}

function isStaffRole(role) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole.includes('staff')
}

function isStaffUser(user) {
  return !!user && isStaffRole(user.role)
}

function isAssignedToSameClinic(currentClinicId, targetClinicId) {
  return !!currentClinicId && currentClinicId === targetClinicId
}

function isAssignedToDifferentClinic(currentClinicId, targetClinicId) {
  return !!currentClinicId && currentClinicId !== targetClinicId
}
/*confirms:
they are staff
the clinic ID is valid
they are not already assigned to the same clinic
they are not already assigned to a different clinic

*/
function canAssignStaffToClinic(user, clinicId) {
  if (!isStaffUser(user)) {
    return {
      valid: false,
      error: 'Selected user is not staff',
      status: 400,
    }
  }

  if (!isValidUuid(clinicId)) {
    return {
      valid: false,
      error: 'Invalid clinic ID format',
      status: 400,
    }
  }

  if (isAssignedToSameClinic(user.clinic_id, clinicId)) {
    return {
      valid: false,
      error: 'Staff member is already assigned to this clinic',
      status: 409,
    }
  }

  if (isAssignedToDifferentClinic(user.clinic_id, clinicId)) {
    return {
      valid: false,
      error: 'Staff member is already assigned to another clinic',
      status: 409,
    }
  }

  return { valid: true }
}

/*confirms:
they are staff
they are currently assigned to a clinic
*/
function canUnassignStaff(user) {
  if (!isStaffUser(user)) {
    return {
      valid: false,
      error: 'Selected user is not staff',
      status: 400,
    }
  }

  if (!user.clinic_id) {
    return {
      valid: false,
      error: 'Staff member is not assigned to a clinic',
      status: 400,
    }
  }

  return { valid: true }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeServicesInput(services) {
  if (Array.isArray(services)) {
    return services.map((service) => service.trim()).filter(Boolean)
  }

  if (typeof services === 'string') {
    return services
      .split(',')
      .map((service) => service.trim())
      .filter(Boolean)
  }

  return []
}

function areValidServices(services) {
  if (services == null) return true

  const normalizedServices = normalizeServicesInput(services)

  return (
    Array.isArray(normalizedServices) &&
    normalizedServices.length > 0 &&
    normalizedServices.every((service) => isNonEmptyString(service))
  )
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

function timeStringToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function isEndAfterStart(start, end) {
  if (!isValidTimeString(start) || !isValidTimeString(end)) return false
  return timeStringToMinutes(end) > timeStringToMinutes(start)
}

function isBlankTime(value) {
  return value === ''
}

function isValidDayName(day) {
  return typeof day === 'string' && VALID_DAYS.includes(day.toLowerCase())
}

function isValidDailyHours(hours) {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) {
    return false
  }

  const open = hours.open ?? ''
  const close = hours.close ?? ''

  const bothBlank = isBlankTime(open) && isBlankTime(close)
  if (bothBlank) return true

  const oneBlank = isBlankTime(open) || isBlankTime(close)
  if (oneBlank) return false

  return isValidTimeString(open) && isValidTimeString(close) && isEndAfterStart(open, close)
}
/*
confirms that the operating hours object:
- is an object (not null or an array)
- contains all valid day keys
- each day's hours are valid (both open and close are either blank or valid time strings, and close is after open)
*/
function isValidOperatingHours(operatingHours) {
  if (!operatingHours || typeof operatingHours !== 'object' || Array.isArray(operatingHours)) {
    return false
  }

  for (const day of VALID_DAYS) {
    if (!Object.prototype.hasOwnProperty.call(operatingHours, day)) {
      return false
    }

    if (!isValidDailyHours(operatingHours[day])) {
      return false
    }
  }

  return true
}
/*
confirms:
they are staff
the clinic name is a non-empty string (if provided)
the facility type is a non-empty string (if provided)
the services list is valid (if provided)
the operating hours object is valid (if provided)

 */
function validateClinicUpdatePayload(payload) {
  const errors = []

  if ('name' in payload && payload.name != null && !isNonEmptyString(payload.name)) {
    errors.push('Clinic name must be a non-empty string')
  }

  if ('facility_type' in payload && payload.facility_type != null && !isNonEmptyString(payload.facility_type)) {
    errors.push('Facility type must be a non-empty string')
  }

  if ('services' in payload && !areValidServices(payload.services)) {
    errors.push('Invalid services list')
  }

  if ('operating_hours' in payload && !isValidOperatingHours(payload.operating_hours)) {
    errors.push('Invalid operating hours')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

module.exports = {
  VALID_DAYS,
  isValidUuid,
  normalizeRole,
  isAdminUser,
  isStaffRole,
  isStaffUser,
  isAssignedToSameClinic,
  isAssignedToDifferentClinic,
  canAssignStaffToClinic,
  canUnassignStaff,
  isNonEmptyString,
  normalizeServicesInput,
  areValidServices,
  isValidTimeString,
  timeStringToMinutes,
  isEndAfterStart,
  isBlankTime,
  isValidDayName,
  isValidDailyHours,
  isValidOperatingHours,
  validateClinicUpdatePayload,
}
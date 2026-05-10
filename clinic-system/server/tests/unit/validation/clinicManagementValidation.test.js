const {
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
  isValidAppointmentDurationMinutes,
  validateClinicUpdatePayload,
} = require('../../../src/clinicManagementValidation')

const clinicId = '123e4567-e89b-12d3-a456-426614174000'
const otherClinicId = '223e4567-e89b-12d3-a456-426614174000'

function makeValidOperatingHours() {
  return {
    monday: { open: '08:00', close: '16:00' },
    tuesday: { open: '08:00', close: '16:00' },
    wednesday: { open: '08:00', close: '16:00' },
    thursday: { open: '08:00', close: '16:00' },
    friday: { open: '08:00', close: '16:00' },
    saturday: { open: '', close: '' },
    sunday: { open: '', close: '' },
  }
}

function staffUser(overrides = {}) {
  return {
    role: 'Clinic Staff',
    clinic_id: null,
    ...overrides,
  }
}

describe('clinicManagementValidation', () => {
  describe('VALID_DAYS', () => {
    test('defines all supported operating hour days', () => {
      expect(VALID_DAYS).toEqual([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ])
    })
  })

  describe('isValidUuid', () => {
    test('returns true for valid UUIDs', () => {
      expect(isValidUuid(clinicId)).toBe(true)
      expect(isValidUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true)
    })

    test('returns false for invalid or non-string values', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(123)).toBe(false)
    })
  })

  describe('role helpers', () => {
    test('normalizeRole trims and lowercases role strings', () => {
      expect(normalizeRole(' Admin ')).toBe('admin')
      expect(normalizeRole('Clinic Staff')).toBe('clinic staff')
    })

    test('normalizeRole returns empty string for non-string values', () => {
      expect(normalizeRole(null)).toBe('')
      expect(normalizeRole(undefined)).toBe('')
      expect(normalizeRole(123)).toBe('')
    })

    test('isAdminUser returns true only for admin users', () => {
      expect(isAdminUser({ role: 'Admin' })).toBe(true)
      expect(isAdminUser({ role: ' admin ' })).toBe(true)
      expect(isAdminUser({ role: 'Patient' })).toBe(false)
      expect(isAdminUser(null)).toBe(false)
    })

    test('isStaffRole returns true for roles containing staff', () => {
      expect(isStaffRole('Clinic Staff')).toBe(true)
      expect(isStaffRole('Staff')).toBe(true)
      expect(isStaffRole('Senior STAFF Member')).toBe(true)
    })

    test('isStaffRole returns false for non-staff roles', () => {
      expect(isStaffRole('Admin')).toBe(false)
      expect(isStaffRole('Patient')).toBe(false)
      expect(isStaffRole(null)).toBe(false)
    })

    test('isStaffUser returns true only for staff users', () => {
      expect(isStaffUser({ role: 'Clinic Staff' })).toBe(true)
      expect(isStaffUser({ role: 'Admin' })).toBe(false)
      expect(isStaffUser(null)).toBe(false)
    })
  })

  describe('clinic assignment helpers', () => {
    test('detects same clinic assignment', () => {
      expect(isAssignedToSameClinic(clinicId, clinicId)).toBe(true)
      expect(isAssignedToSameClinic(null, clinicId)).toBe(false)
    })

    test('detects different clinic assignment', () => {
      expect(isAssignedToDifferentClinic(clinicId, otherClinicId)).toBe(true)
      expect(isAssignedToDifferentClinic(null, otherClinicId)).toBe(false)
      expect(isAssignedToDifferentClinic(clinicId, clinicId)).toBe(false)
    })

    test('allows valid staff assignment', () => {
      expect(canAssignStaffToClinic(staffUser(), clinicId)).toEqual({
        valid: true,
      })
    })

    test('rejects assignment for non-staff user', () => {
      expect(
        canAssignStaffToClinic(
          {
            role: 'Admin',
            clinic_id: null,
          },
          clinicId
        )
      ).toEqual({
        valid: false,
        error: 'Selected user is not staff',
        status: 400,
      })
    })

    test('rejects assignment for invalid clinic UUID', () => {
      expect(canAssignStaffToClinic(staffUser(), 'bad-id')).toEqual({
        valid: false,
        error: 'Invalid clinic ID format',
        status: 400,
      })
    })

    test('rejects assignment when staff member is already assigned to same clinic', () => {
      expect(
        canAssignStaffToClinic(
          staffUser({
            clinic_id: clinicId,
          }),
          clinicId
        )
      ).toEqual({
        valid: false,
        error: 'Staff member is already assigned to this clinic',
        status: 409,
      })
    })

    test('rejects assignment when staff member is already assigned to another clinic', () => {
      expect(
        canAssignStaffToClinic(
          staffUser({
            clinic_id: clinicId,
          }),
          otherClinicId
        )
      ).toEqual({
        valid: false,
        error: 'Staff member is already assigned to another clinic',
        status: 409,
      })
    })

    test('allows valid staff unassignment', () => {
      expect(
        canUnassignStaff(
          staffUser({
            clinic_id: clinicId,
          })
        )
      ).toEqual({
        valid: true,
      })
    })

    test('rejects unassignment for non-staff user', () => {
      expect(
        canUnassignStaff({
          role: 'Patient',
          clinic_id: clinicId,
        })
      ).toEqual({
        valid: false,
        error: 'Selected user is not staff',
        status: 400,
      })
    })

    test('rejects unassignment when staff member has no clinic assignment', () => {
      expect(canUnassignStaff(staffUser())).toEqual({
        valid: false,
        error: 'Staff member is not assigned to a clinic',
        status: 400,
      })
    })
  })

  describe('string and services helpers', () => {
    test('isNonEmptyString accepts strings with non-whitespace content', () => {
      expect(isNonEmptyString('Clinic')).toBe(true)
      expect(isNonEmptyString(' Clinic ')).toBe(true)
    })

    test('isNonEmptyString rejects empty, whitespace, and non-string values', () => {
      expect(isNonEmptyString('')).toBe(false)
      expect(isNonEmptyString('   ')).toBe(false)
      expect(isNonEmptyString(null)).toBe(false)
      expect(isNonEmptyString(123)).toBe(false)
    })

    test('normalizes services from comma-separated string', () => {
      expect(normalizeServicesInput('General Care, Dental,  Pharmacy ')).toEqual([
        'General Care',
        'Dental',
        'Pharmacy',
      ])
    })

    test('normalizes services from array', () => {
      expect(normalizeServicesInput(['General Care', ' Dental ', ''])).toEqual([
        'General Care',
        'Dental',
      ])
    })

    test('returns empty array for unsupported services input types', () => {
      expect(normalizeServicesInput(123)).toEqual([])
      expect(normalizeServicesInput(undefined)).toEqual([])
      expect(normalizeServicesInput(null)).toEqual([])
    })

    test('accepts valid service values and null services', () => {
      expect(areValidServices('General Care, Dental')).toBe(true)
      expect(areValidServices(['HIV Testing', 'TB Treatment'])).toBe(true)
      expect(areValidServices(null)).toBe(true)
      expect(areValidServices(undefined)).toBe(true)
    })

    test('rejects empty or meaningless service values', () => {
      expect(areValidServices(' , , ')).toBe(false)
      expect(areValidServices('3')).toBe(false)
      expect(areValidServices('@@@')).toBe(false)
      expect(areValidServices(['123', '!!!'])).toBe(false)
      expect(areValidServices(['General Care', '!!!'])).toBe(false)
    })
  })

  describe('time helpers', () => {
    test.each(['00:00', '08:30', '23:59'])(
      'accepts valid time string %s',
      (time) => {
        expect(isValidTimeString(time)).toBe(true)
      }
    )

    test.each(['24:00', '25:00', '12:60', '8:30', 'bad-time', '', null])(
      'rejects invalid time string %s',
      (time) => {
        expect(isValidTimeString(time)).toBe(false)
      }
    )

    test('converts time strings to minutes after midnight', () => {
      expect(timeStringToMinutes('00:00')).toBe(0)
      expect(timeStringToMinutes('02:30')).toBe(150)
      expect(timeStringToMinutes('23:59')).toBe(1439)
    })

    test('detects when end time is after start time', () => {
      expect(isEndAfterStart('08:00', '16:00')).toBe(true)
      expect(isEndAfterStart('08:00', '08:01')).toBe(true)
    })

    test('returns false when end time is not after start time or times are invalid', () => {
      expect(isEndAfterStart('16:00', '08:00')).toBe(false)
      expect(isEndAfterStart('08:00', '08:00')).toBe(false)
      expect(isEndAfterStart('bad-time', '16:00')).toBe(false)
      expect(isEndAfterStart('08:00', 'bad-time')).toBe(false)
    })

    test('detects blank time string', () => {
      expect(isBlankTime('')).toBe(true)
      expect(isBlankTime(' ')).toBe(false)
      expect(isBlankTime(null)).toBe(false)
    })
  })

  describe('operating hours validation', () => {
    test('accepts valid day names case-insensitively', () => {
      expect(isValidDayName('monday')).toBe(true)
      expect(isValidDayName('Monday')).toBe(true)
      expect(isValidDayName('SUNDAY')).toBe(true)
    })

    test('rejects invalid day names', () => {
      expect(isValidDayName('funday')).toBe(false)
      expect(isValidDayName(null)).toBe(false)
    })

    test('accepts valid daily hours', () => {
      expect(isValidDailyHours({ open: '08:00', close: '16:00' })).toBe(true)
    })

    test('accepts blank daily hours as a closed day', () => {
      expect(isValidDailyHours({ open: '', close: '' })).toBe(true)
    })

    test('rejects invalid daily hours', () => {
      expect(isValidDailyHours({ open: '08:00', close: '' })).toBe(false)
      expect(isValidDailyHours({ open: '', close: '16:00' })).toBe(false)
      expect(isValidDailyHours({ open: '16:00', close: '08:00' })).toBe(false)
      expect(isValidDailyHours({ open: '08:00', close: 'bad-time' })).toBe(false)
      expect(isValidDailyHours('08:00-16:00')).toBe(false)
      expect(isValidDailyHours([])).toBe(false)
      expect(isValidDailyHours(null)).toBe(false)
    })

    test('accepts valid operating hours object', () => {
      expect(isValidOperatingHours(makeValidOperatingHours())).toBe(true)
    })

    test('rejects operating hours when a day is missing', () => {
      const hours = makeValidOperatingHours()
      delete hours.sunday

      expect(isValidOperatingHours(hours)).toBe(false)
    })

    test('rejects operating hours when one day is invalid', () => {
      const hours = makeValidOperatingHours()
      hours.monday = { open: '17:00', close: '08:00' }

      expect(isValidOperatingHours(hours)).toBe(false)
    })

    test('rejects operating hours when value is not a plain object', () => {
      expect(isValidOperatingHours('closed')).toBe(false)
      expect(isValidOperatingHours([])).toBe(false)
      expect(isValidOperatingHours(null)).toBe(false)
    })
  })

  describe('appointment duration validation', () => {
    test('accepts null as default duration', () => {
      expect(isValidAppointmentDurationMinutes(null)).toBe(true)
    })

    test.each([1, 15, 240])(
      'accepts integer duration %i between 1 and 240',
      (duration) => {
        expect(isValidAppointmentDurationMinutes(duration)).toBe(true)
      }
    )

    test.each([0, -15, 241, 12.5, '15', undefined])(
      'rejects invalid duration %s',
      (duration) => {
        expect(isValidAppointmentDurationMinutes(duration)).toBe(false)
      }
    )
  })

  describe('validateClinicUpdatePayload', () => {
    test('accepts empty update payload', () => {
      expect(validateClinicUpdatePayload({})).toEqual({
        valid: true,
        errors: [],
      })
    })

    test('accepts valid clinic update payload', () => {
      expect(
        validateClinicUpdatePayload({
          name: 'Hillbrow Clinic',
          facility_type: 'Clinic',
          services: 'General Care, Dental',
          operating_hours: makeValidOperatingHours(),
          appointment_duration_minutes: 30,
        })
      ).toEqual({
        valid: true,
        errors: [],
      })
    })

    test('accepts nullable optional update fields', () => {
      expect(
        validateClinicUpdatePayload({
          name: null,
          facility_type: null,
          services: null,
          appointment_duration_minutes: null,
        })
      ).toEqual({
        valid: true,
        errors: [],
      })
    })

    test('rejects empty clinic name', () => {
      expect(validateClinicUpdatePayload({ name: '   ' })).toEqual({
        valid: false,
        errors: ['Clinic name must be a non-empty string'],
      })
    })

    test('rejects empty facility type', () => {
      expect(validateClinicUpdatePayload({ facility_type: '' })).toEqual({
        valid: false,
        errors: ['Facility type must be a non-empty string'],
      })
    })

    test.each([' , ', '123', '@@@'])(
      'rejects invalid services list %s',
      (services) => {
        expect(validateClinicUpdatePayload({ services })).toEqual({
          valid: false,
          errors: ['Invalid services list'],
        })
      }
    )

    test('rejects invalid operating hours', () => {
      expect(
        validateClinicUpdatePayload({
          operating_hours: {
            monday: { open: '17:00', close: '08:00' },
          },
        })
      ).toEqual({
        valid: false,
        errors: ['Invalid operating hours'],
      })
    })

    test('rejects invalid appointment duration', () => {
      expect(validateClinicUpdatePayload({ appointment_duration_minutes: 0 })).toEqual({
        valid: false,
        errors: ['Invalid appointment duration'],
      })
    })

    test('returns multiple errors when multiple fields are invalid', () => {
      expect(
        validateClinicUpdatePayload({
          name: '',
          facility_type: '   ',
          services: ' , ',
          operating_hours: null,
          appointment_duration_minutes: 0,
        })
      ).toEqual({
        valid: false,
        errors: [
          'Clinic name must be a non-empty string',
          'Facility type must be a non-empty string',
          'Invalid services list',
          'Invalid operating hours',
          'Invalid appointment duration',
        ],
      })
    })
  })
})
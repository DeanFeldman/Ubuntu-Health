const {
  isValidUuid,
  isAdminUser,
  isStaffRole,
  isStaffUser,
  isAssignedToSameClinic,
  isAssignedToDifferentClinic,
  canAssignStaffToClinic,
  canUnassignStaff,
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
} = require('../src/clinicManagementValidation')

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

describe('clinicManagementValidation', () => {
  describe('isValidUuid', () => {
    test('returns true for a valid UUID', () => {
      expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    })

    test('returns false for an invalid UUID', () => {
      expect(isValidUuid('not-a-uuid')).toBe(false)
    })

    test('returns false for non-string input', () => {
      expect(isValidUuid(null)).toBe(false)
    })
  })

  describe('role validation', () => {
    test('isAdminUser returns true for admin user', () => {
      expect(isAdminUser({ role: 'Admin' })).toBe(true)
    })

    test('isAdminUser returns false for non-admin user', () => {
      expect(isAdminUser({ role: 'Patient' })).toBe(false)
    })

    test('isStaffRole returns true for clinic staff role', () => {
      expect(isStaffRole('Clinic Staff')).toBe(true)
    })

    test('isStaffRole returns false for patient role', () => {
      expect(isStaffRole('Patient')).toBe(false)
    })

    test('isStaffUser returns true for staff user', () => {
      expect(isStaffUser({ role: 'Clinic Staff' })).toBe(true)
    })

    test('isStaffUser returns false for non-staff user', () => {
      expect(isStaffUser({ role: 'Admin' })).toBe(false)
    })
  })

  describe('clinic assignment helpers', () => {
    test('detects same clinic assignment', () => {
      expect(
        isAssignedToSameClinic(
          '123e4567-e89b-12d3-a456-426614174000',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).toBe(true)
    })

    test('detects different clinic assignment', () => {
      expect(
        isAssignedToDifferentClinic(
          '123e4567-e89b-12d3-a456-426614174000',
          '223e4567-e89b-12d3-a456-426614174000'
        )
      ).toBe(true)
    })

    test('allows valid staff assignment', () => {
      const result = canAssignStaffToClinic(
        {
          role: 'Clinic Staff',
          clinic_id: null,
        },
        '123e4567-e89b-12d3-a456-426614174000'
      )

      expect(result).toEqual({ valid: true })
    })

    test('rejects assignment for non-staff user', () => {
      const result = canAssignStaffToClinic(
        {
          role: 'Admin',
          clinic_id: null,
        },
        '123e4567-e89b-12d3-a456-426614174000'
      )

      expect(result).toEqual({
        valid: false,
        error: 'Selected user is not staff',
        status: 400,
      })
    })

    test('rejects assignment for invalid clinic UUID', () => {
      const result = canAssignStaffToClinic(
        {
          role: 'Clinic Staff',
          clinic_id: null,
        },
        'bad-id'
      )

      expect(result).toEqual({
        valid: false,
        error: 'Invalid clinic ID format',
        status: 400,
      })
    })

    test('rejects assignment when already assigned to same clinic', () => {
      const clinicId = '123e4567-e89b-12d3-a456-426614174000'

      const result = canAssignStaffToClinic(
        {
          role: 'Clinic Staff',
          clinic_id: clinicId,
        },
        clinicId
      )

      expect(result).toEqual({
        valid: false,
        error: 'Staff member is already assigned to this clinic',
        status: 409,
      })
    })

    test('rejects assignment when already assigned to another clinic', () => {
      const result = canAssignStaffToClinic(
        {
          role: 'Clinic Staff',
          clinic_id: '123e4567-e89b-12d3-a456-426614174000',
        },
        '223e4567-e89b-12d3-a456-426614174000'
      )

      expect(result).toEqual({
        valid: false,
        error: 'Staff member is already assigned to another clinic',
        status: 409,
      })
    })

    test('allows valid staff unassignment', () => {
      const result = canUnassignStaff({
        role: 'Clinic Staff',
        clinic_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result).toEqual({ valid: true })
    })

    test('rejects unassignment for non-staff user', () => {
      const result = canUnassignStaff({
        role: 'Patient',
        clinic_id: '123e4567-e89b-12d3-a456-426614174000',
      })

      expect(result).toEqual({
        valid: false,
        error: 'Selected user is not staff',
        status: 400,
      })
    })

    test('rejects unassignment when user has no clinic', () => {
      const result = canUnassignStaff({
        role: 'Clinic Staff',
        clinic_id: null,
      })

      expect(result).toEqual({
        valid: false,
        error: 'Staff member is not assigned to a clinic',
        status: 400,
      })
    })
  })

  describe('services validation', () => {
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

    test('accepts valid services string', () => {
      expect(areValidServices('General Care, Dental')).toBe(true)
    })

    test('accepts valid services array', () => {
      expect(areValidServices(['General Care', 'Dental'])).toBe(true)
    })

    test('accepts null services', () => {
      expect(areValidServices(null)).toBe(true)
    })

    test('rejects empty services string', () => {
      expect(areValidServices(' , , ')).toBe(false)
    })
  })

  describe('time validation', () => {
    test('accepts valid time string', () => {
      expect(isValidTimeString('08:30')).toBe(true)
    })

    test('rejects invalid time string', () => {
      expect(isValidTimeString('25:00')).toBe(false)
    })

    test('converts time string to minutes', () => {
      expect(timeStringToMinutes('02:30')).toBe(150)
    })

    test('returns true when end is after start', () => {
      expect(isEndAfterStart('08:00', '16:00')).toBe(true)
    })

    test('returns false when end is before start', () => {
      expect(isEndAfterStart('16:00', '08:00')).toBe(false)
    })

    test('detects blank time string', () => {
      expect(isBlankTime('')).toBe(true)
    })
  })

  describe('operating hours validation', () => {
    test('accepts valid day name', () => {
      expect(isValidDayName('monday')).toBe(true)
    })

    test('rejects invalid day name', () => {
      expect(isValidDayName('funday')).toBe(false)
    })

    test('accepts valid daily hours', () => {
      expect(isValidDailyHours({ open: '08:00', close: '16:00' })).toBe(true)
    })

    test('accepts blank daily hours as closed day', () => {
      expect(isValidDailyHours({ open: '', close: '' })).toBe(true)
    })

    test('rejects daily hours with only one blank value', () => {
      expect(isValidDailyHours({ open: '08:00', close: '' })).toBe(false)
    })

    test('rejects daily hours when close is before open', () => {
      expect(isValidDailyHours({ open: '16:00', close: '08:00' })).toBe(false)
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
  })

  describe('validateClinicUpdatePayload', () => {
    test('accepts valid clinic update payload', () => {
      const result = validateClinicUpdatePayload({
        name: 'Hillbrow Clinic',
        facility_type: 'Clinic',
        services: 'General Care, Dental',
        operating_hours: makeValidOperatingHours(),
      })

      expect(result).toEqual({
        valid: true,
        errors: [],
      })
    })

    test('rejects empty clinic name', () => {
      const result = validateClinicUpdatePayload({
        name: '   ',
      })

      expect(result).toEqual({
        valid: false,
        errors: ['Clinic name must be a non-empty string'],
      })
    })

    test('rejects empty facility type', () => {
      const result = validateClinicUpdatePayload({
        facility_type: '',
      })

      expect(result).toEqual({
        valid: false,
        errors: ['Facility type must be a non-empty string'],
      })
    })

    test('rejects invalid services list', () => {
      const result = validateClinicUpdatePayload({
        services: ' , ',
      })

      expect(result).toEqual({
        valid: false,
        errors: ['Invalid services list'],
      })
    })

    test('rejects invalid operating hours', () => {
      const result = validateClinicUpdatePayload({
        operating_hours: {
          monday: { open: '17:00', close: '08:00' },
        },
      })

      expect(result).toEqual({
        valid: false,
        errors: ['Invalid operating hours'],
      })
    })

    test('returns multiple errors when multiple fields are invalid', () => {
      const result = validateClinicUpdatePayload({
        name: '',
        facility_type: '   ',
        services: ' , ',
      })

      expect(result).toEqual({
        valid: false,
        errors: [
          'Clinic name must be a non-empty string',
          'Facility type must be a non-empty string',
          'Invalid services list',
        ],
      })
    })
  })
})
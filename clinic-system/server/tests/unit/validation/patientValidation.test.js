const {
  isValidUuid,
  isValidEmail,
  validatePatientInput,
  calculateEstimatedWaitTime,
} = require('../../../src/patientValidation')

const validUuid = '123e4567-e89b-12d3-a456-426614174000'

const validPatientInput = {
  full_name: 'Amara Dlamini',
  email: 'amara@example.com',
  created_by: validUuid,
}

describe('patientValidation', () => {
  describe('isValidUuid', () => {
    test('returns true for a valid UUID', () => {
      expect(isValidUuid(validUuid)).toBe(true)
    })

    test('returns false for invalid UUID values', () => {
      expect(isValidUuid('abc')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(123)).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    test('returns true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('patient.name+test@example.co.za')).toBe(true)
    })

    test('returns false for invalid email addresses', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('missing-domain@')).toBe(false)
      expect(isValidEmail('@missing-name.com')).toBe(false)
      expect(isValidEmail('test example.com')).toBe(false)
    })
  })

  describe('validatePatientInput', () => {
    test('accepts valid patient input', () => {
      expect(validatePatientInput(validPatientInput)).toEqual({
        valid: true,
      })
    })

    test('accepts input with trimmed full name and email', () => {
      expect(
        validatePatientInput({
          full_name: '  Amara Dlamini  ',
          email: '  amara@example.com  ',
          created_by: validUuid,
        })
      ).toEqual({
        valid: true,
      })
    })

    test.each([
      ['', 'full_name is required'],
      ['   ', 'full_name is required'],
      [null, 'full_name is required'],
      [undefined, 'full_name is required'],
    ])('rejects missing full_name value %s', (full_name, error) => {
      expect(
        validatePatientInput({
          ...validPatientInput,
          full_name,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error,
      })
    })

    test.each([
      ['', 'email is required'],
      ['   ', 'email is required'],
      [null, 'email is required'],
      [undefined, 'email is required'],
    ])('rejects missing email value %s', (email, error) => {
      expect(
        validatePatientInput({
          ...validPatientInput,
          email,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error,
      })
    })

    test.each([
      'amara-at-example',
      'not-an-email',
      'missing-domain@',
      '@missing-name.com',
    ])('rejects invalid email value %s', (email) => {
      expect(
        validatePatientInput({
          ...validPatientInput,
          email,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid email format',
      })
    })

    test.each([
      '',
      null,
      undefined,
    ])('rejects missing created_by value %s', (created_by) => {
      expect(
        validatePatientInput({
          ...validPatientInput,
          created_by,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'created_by is required',
      })
    })

    test('rejects invalid created_by UUID format', () => {
      expect(
        validatePatientInput({
          ...validPatientInput,
          created_by: 'bad-id',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid created_by ID format',
      })
    })
  })

  describe('calculateEstimatedWaitTime', () => {
    test('returns estimate based on patients ahead, appointment duration, and staff count', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 4,
          appointmentDuration: 15,
          staffCount: 2,
        })
      ).toEqual({
        estimatedWaitTime: 30,
      })
    })

    test('rounds wait estimate up to the nearest minute', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 3,
          appointmentDuration: 10,
          staffCount: 4,
        })
      ).toEqual({
        estimatedWaitTime: 8,
      })
    })

    test('returns zero wait time when no patients are ahead', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 0,
          appointmentDuration: 15,
          staffCount: 2,
        })
      ).toEqual({
        estimatedWaitTime: 0,
      })
    })

    test('treats invalid or negative patientsAhead as zero', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: -3,
          appointmentDuration: 15,
          staffCount: 2,
        })
      ).toEqual({
        estimatedWaitTime: 0,
      })

      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 'bad-value',
          appointmentDuration: 15,
          staffCount: 2,
        })
      ).toEqual({
        estimatedWaitTime: 0,
      })
    })

    test('uses default appointment duration when duration is invalid', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 2,
          appointmentDuration: 0,
          staffCount: 1,
        })
      ).toEqual({
        estimatedWaitTime: 30,
      })
    })

    test('returns unavailable estimate when staff count is missing or invalid', () => {
      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 2,
          appointmentDuration: 15,
          staffCount: 0,
        })
      ).toEqual({
        estimatedWaitTime: null,
        message: 'Estimate not available',
      })

      expect(
        calculateEstimatedWaitTime({
          patientsAhead: 2,
          appointmentDuration: 15,
          staffCount: null,
        })
      ).toEqual({
        estimatedWaitTime: null,
        message: 'Estimate not available',
      })
    })
  })
})
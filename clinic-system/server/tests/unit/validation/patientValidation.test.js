const {
  isValidUuid,
  isValidEmail,
  validatePatientInput,
} = require('../../../src/patientValidation')

describe('patientValidation', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'

  describe('isValidUuid', () => {
    test('returns true for a valid uuid', () => {
      expect(isValidUuid(validUuid)).toBe(true)
    })

    test('returns false for an invalid uuid', () => {
      expect(isValidUuid('abc')).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    test('returns true for a valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    test('returns false for an invalid email', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
    })
  })

  describe('validatePatientInput', () => {
    test('passes for valid input', () => {
      expect(
        validatePatientInput({
          full_name: 'Amara Dlamini',
          email: 'amara@example.com',
          created_by: validUuid,
        })
      ).toEqual({ valid: true })
    })

    test('rejects missing full_name', () => {
      expect(
        validatePatientInput({
          full_name: '',
          email: 'amara@example.com',
          created_by: validUuid,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'full_name is required',
      })
    })

    test('rejects missing email', () => {
      expect(
        validatePatientInput({
          full_name: 'Amara Dlamini',
          email: '',
          created_by: validUuid,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'email is required',
      })
    })

    test('rejects invalid email', () => {
      expect(
        validatePatientInput({
          full_name: 'Amara Dlamini',
          email: 'amara-at-example',
          created_by: validUuid,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid email format',
      })
    })

    test('rejects missing created_by', () => {
      expect(
        validatePatientInput({
          full_name: 'Amara Dlamini',
          email: 'amara@example.com',
          created_by: '',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'created_by is required',
      })
    })

    test('rejects invalid created_by format', () => {
      expect(
        validatePatientInput({
          full_name: 'Amara Dlamini',
          email: 'amara@example.com',
          created_by: 'bad-id',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid created_by ID format',
      })
    })
  })
})
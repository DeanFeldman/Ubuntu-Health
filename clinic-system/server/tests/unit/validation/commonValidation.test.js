const {
  isValidUuid,
  validateRequiredUuid,
  validateRequiredUuids,
} = require('../../../src/commonValidation')

const VALID_UUID = '0b0d9f9a-9a5e-47fe-92e0-7d1696e41464'
const VALID_UUID_UPPERCASE = '0B0D9F9A-9A5E-47FE-92E0-7D1696E41464'
const INVALID_UUID = 'not-a-uuid'

describe('commonValidation', () => {
  describe('isValidUuid', () => {
    test('returns true for a valid lowercase UUID', () => {
      expect(isValidUuid(VALID_UUID)).toBe(true)
    })

    test('returns true for a valid uppercase UUID', () => {
      expect(isValidUuid(VALID_UUID_UPPERCASE)).toBe(true)
    })

    test('returns false for invalid UUID values', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid('0b0d9f9a9a5e47fe92e07d1696e41464')).toBe(false)
    })

    test('returns false for missing or non-string UUID values', () => {
      expect(isValidUuid()).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(123)).toBe(false)
    })
  })

  describe('validateRequiredUuid', () => {
    test('accepts a valid required UUID field', () => {
      expect(validateRequiredUuid(VALID_UUID, 'clinicId')).toEqual({
        valid: true,
      })
    })

    test('rejects a missing required UUID field', () => {
      expect(validateRequiredUuid(undefined, 'clinicId')).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    test('rejects an empty required UUID field', () => {
      expect(validateRequiredUuid('', 'clinicId')).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    test('rejects an invalid required UUID field', () => {
      expect(validateRequiredUuid(INVALID_UUID, 'clinicId')).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinicId format',
      })
    })
  })

  describe('validateRequiredUuids', () => {
    test('accepts multiple valid UUID fields', () => {
      expect(
        validateRequiredUuids({
          clinicId: VALID_UUID,
          patientId: '11111111-1111-4111-8111-111111111111',
        })
      ).toEqual({
        valid: true,
      })
    })

    test('rejects the first missing UUID field', () => {
      expect(
        validateRequiredUuids({
          clinicId: '',
          patientId: VALID_UUID,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    test('rejects the first invalid UUID field', () => {
      expect(
        validateRequiredUuids({
          clinicId: VALID_UUID,
          patientId: INVALID_UUID,
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid patientId format',
      })
    })

    test('stops at the first invalid field', () => {
      expect(
        validateRequiredUuids({
          clinicId: INVALID_UUID,
          patientId: '',
        })
      ).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinicId format',
      })
    })
  })
})
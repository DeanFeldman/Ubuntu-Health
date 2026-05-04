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
    it('returns true for a valid lowercase UUID', () => {
      expect(isValidUuid(VALID_UUID)).toBe(true)
    })

    it('returns true for a valid uppercase UUID', () => {
      expect(isValidUuid(VALID_UUID_UPPERCASE)).toBe(true)
    })

    it('returns false for an invalid UUID string', () => {
      expect(isValidUuid(INVALID_UUID)).toBe(false)
    })

    it('returns false for a missing UUID', () => {
      expect(isValidUuid()).toBe(false)
    })

    it('returns false for null UUID', () => {
      expect(isValidUuid(null)).toBe(false)
    })

    it('returns false for non-string UUID value', () => {
      expect(isValidUuid(123)).toBe(false)
    })

    it('returns false for UUID without hyphens', () => {
      expect(isValidUuid('0b0d9f9a9a5e47fe92e07d1696e41464')).toBe(false)
    })
  })

  describe('validateRequiredUuid', () => {
    it('rejects a missing required UUID field', () => {
      const result = validateRequiredUuid(undefined, 'clinicId')

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    it('rejects an empty required UUID field', () => {
      const result = validateRequiredUuid('', 'clinicId')

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    it('rejects an invalid required UUID field', () => {
      const result = validateRequiredUuid(INVALID_UUID, 'clinicId')

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinicId format',
      })
    })

    it('accepts a valid required UUID field', () => {
      const result = validateRequiredUuid(VALID_UUID, 'clinicId')

      expect(result).toEqual({ valid: true })
    })
  })

  describe('validateRequiredUuids', () => {
    it('accepts multiple valid UUID fields', () => {
      const result = validateRequiredUuids({
        clinicId: VALID_UUID,
        patientId: '11111111-1111-4111-8111-111111111111',
      })

      expect(result).toEqual({ valid: true })
    })

    it('rejects the first missing UUID field', () => {
      const result = validateRequiredUuids({
        clinicId: '',
        patientId: VALID_UUID,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'clinicId is required',
      })
    })

    it('rejects the first invalid UUID field', () => {
      const result = validateRequiredUuids({
        clinicId: VALID_UUID,
        patientId: INVALID_UUID,
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid patientId format',
      })
    })

    it('stops at the first invalid field', () => {
      const result = validateRequiredUuids({
        clinicId: INVALID_UUID,
        patientId: '',
      })

      expect(result).toEqual({
        valid: false,
        status: 400,
        error: 'Invalid clinicId format',
      })
    })
  })
})
const {
  hasRequiredRoleRequestFields,
  isValidUuid,
  isValidRequestedRole,
  isDifferentFromCurrentRole,
  doesUserExist,
  hasDuplicatePendingRoleRequest,
} = require('../../../src/roleRequestValidation')

const validUserId = '00000000-0000-0000-0000-000000000001'

describe('roleRequestValidation', () => {
  describe('hasRequiredRoleRequestFields', () => {
    test('returns true when both required fields are provided', () => {
      expect(hasRequiredRoleRequestFields(validUserId, 'Staff')).toBe(true)
    })

    test.each([
      ['', 'Staff'],
      [null, 'Staff'],
      [undefined, 'Staff'],
      [validUserId, ''],
      [validUserId, null],
      [validUserId, undefined],
    ])('returns false when required fields are missing', (userId, requestedRole) => {
      expect(hasRequiredRoleRequestFields(userId, requestedRole)).toBe(false)
    })
  })

  describe('isValidUuid', () => {
    test('returns true for a valid UUID', () => {
      expect(isValidUuid(validUserId)).toBe(true)
    })

    test('returns false for invalid UUID values', () => {
      expect(isValidUuid('invalid-id')).toBe(false)
      expect(isValidUuid('')).toBe(false)
      expect(isValidUuid(null)).toBe(false)
      expect(isValidUuid(undefined)).toBe(false)
      expect(isValidUuid(123)).toBe(false)
    })
  })

  describe('isValidRequestedRole', () => {
    test.each(['Patient', 'Staff', 'Admin'])(
      'accepts %s as a valid requested role',
      (requestedRole) => {
        expect(isValidRequestedRole(requestedRole)).toBe(true)
      }
    )

    test.each(['SuperUser', 'staff', '', null, undefined])(
      'rejects unsupported requested role %s',
      (requestedRole) => {
        expect(isValidRequestedRole(requestedRole)).toBe(false)
      }
    )
  })

  describe('isDifferentFromCurrentRole', () => {
    test('returns true when requested role differs from current role', () => {
      expect(isDifferentFromCurrentRole('Patient', 'Staff')).toBe(true)
    })

    test('returns false when requested role matches current role', () => {
      expect(isDifferentFromCurrentRole('Staff', 'Staff')).toBe(false)
    })
  })

  describe('doesUserExist', () => {
    test('returns true when a user record exists', () => {
      expect(doesUserExist({ id: 'user-1', role: 'Patient' })).toBe(true)
    })

    test('returns false when a user record does not exist', () => {
      expect(doesUserExist(null)).toBe(false)
      expect(doesUserExist(undefined)).toBe(false)
    })
  })

  describe('hasDuplicatePendingRoleRequest', () => {
    test('returns true when a duplicate pending role request exists', () => {
      expect(hasDuplicatePendingRoleRequest({ id: 'request-1' })).toBe(true)
    })

    test('returns false when no duplicate pending role request exists', () => {
      expect(hasDuplicatePendingRoleRequest(null)).toBe(false)
      expect(hasDuplicatePendingRoleRequest(undefined)).toBe(false)
    })
  })
})
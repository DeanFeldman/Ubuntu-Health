const {
  hasRequiredRoleRequestFields,
  isValidUuid,
  isValidRequestedRole,
  isDifferentFromCurrentRole,
  doesUserExist,
  hasDuplicatePendingRoleRequest,
} = require('../../../src/roleRequestValidation')

describe('Role request validation helpers', () => {
  test('returns true when both required fields are provided', () => {
    expect(
      hasRequiredRoleRequestFields(
        '00000000-0000-0000-0000-000000000001',
        'Staff'
      )
    ).toBe(true)
  })

  test('returns false when user_id is missing', () => {
    expect(hasRequiredRoleRequestFields('', 'Staff')).toBe(false)
  })

  test('returns false when requested_role is missing', () => {
    expect(
      hasRequiredRoleRequestFields(
        '00000000-0000-0000-0000-000000000001',
        ''
      )
    ).toBe(false)
  })

  test('returns true for a valid UUID', () => {
    expect(isValidUuid('00000000-0000-0000-0000-000000000001')).toBe(true)
  })

  test('returns false for an invalid UUID', () => {
    expect(isValidUuid('invalid-id')).toBe(false)
  })

  test('accepts Patient as a valid requested role', () => {
    expect(isValidRequestedRole('Patient')).toBe(true)
  })

  test('accepts Staff as a valid requested role', () => {
    expect(isValidRequestedRole('Staff')).toBe(true)
  })

  test('accepts Admin as a valid requested role', () => {
    expect(isValidRequestedRole('Admin')).toBe(true)
  })

  test('rejects an unsupported requested role', () => {
    expect(isValidRequestedRole('SuperUser')).toBe(false)
  })

  test('returns true when requested role differs from current role', () => {
    expect(isDifferentFromCurrentRole('Patient', 'Staff')).toBe(true)
  })

  test('returns false when requested role matches current role', () => {
    expect(isDifferentFromCurrentRole('Staff', 'Staff')).toBe(false)
  })

  test('returns true when a user record exists', () => {
    expect(doesUserExist({ id: 'user-1', role: 'Patient' })).toBe(true)
  })

  test('returns false when a user record does not exist', () => {
    expect(doesUserExist(null)).toBe(false)
  })

  test('returns true when a duplicate pending role request exists', () => {
    expect(hasDuplicatePendingRoleRequest({ id: 'request-1' })).toBe(true)
  })

  test('returns false when no duplicate pending role request exists', () => {
    expect(hasDuplicatePendingRoleRequest(null)).toBe(false)
  })
})
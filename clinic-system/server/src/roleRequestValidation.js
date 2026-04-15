// Checks whether both required fields for a role request were provided.
function hasRequiredRoleRequestFields(userId, requestedRole) {
  return Boolean(userId && requestedRole)
}

// Checks whether the provided id is in valid UUID format.
function isValidUuid(id) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  return uuidRegex.test(id)
}

// Checks whether the requested role is one of the supported system roles.
function isValidRequestedRole(requestedRole) {
  const allowedRoles = ['Patient', 'Staff', 'Admin']
  return allowedRoles.includes(requestedRole)
}

// Checks whether the user is requesting a different role from their current one.
function isDifferentFromCurrentRole(currentRole, requestedRole) {
  return currentRole !== requestedRole
}

// Checks whether a user record exists.
function doesUserExist(user) {
  return Boolean(user)
}

// Checks whether a pending request already exists for the same user and role.
function hasDuplicatePendingRoleRequest(existingRequest) {
  return Boolean(existingRequest)
}

module.exports = {
  hasRequiredRoleRequestFields,
  isValidUuid,
  isValidRequestedRole,
  isDifferentFromCurrentRole,
  doesUserExist,
  hasDuplicatePendingRoleRequest,
}
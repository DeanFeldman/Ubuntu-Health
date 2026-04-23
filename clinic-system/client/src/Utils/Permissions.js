export const ROLE_PERMISSIONS = {
  Admin: ['admin', 'clinic'],
  Staff: ['staff', 'clinic'],
  Patient: ['clinic'],
}

export function canAccess(role, route) {
  return ROLE_PERMISSIONS[role]?.includes(route) ?? false
}
export const ROLE_PERMISSIONS = {
  Admin: ['admin', 'staff', 'clinic'],
  Staff: ['staff', 'clinic'],
  Patient: ['clinic'],
}

export function canAccess(role, route) {
  return ROLE_PERMISSIONS[role]?.includes(route) ?? false
}
export function hasAnyRole(userRole: string, allowedRoles: readonly string[]) {
  return allowedRoles.includes(userRole)
}

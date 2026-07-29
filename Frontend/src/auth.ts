export const PLATFORM_ADMIN_ROLE = "platform admin";
export const EMPLOYEE_ROLE = "employee";
export const CLIENT_ROLE = "client";
export const ARCHITECT_ROLE = "architect";
const AUTH_ROLES_KEY = "blueprint.auth.roles";
const LEGACY_AUTH_ROLE_KEY = "blueprint.auth.role";

export function getAuthenticatedRoles(): string[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(AUTH_ROLES_KEY) ?? "[]");
    return Array.isArray(value) && value.every((role) => typeof role === "string")
      ? value
      : [];
  } catch {
    return [];
  }
}

export function setAuthenticatedRoles(roles: string[]) {
  sessionStorage.setItem(AUTH_ROLES_KEY, JSON.stringify([...new Set(roles)]));
  sessionStorage.removeItem(LEGACY_AUTH_ROLE_KEY);
}

export function clearAuthenticatedRoles() {
  sessionStorage.removeItem(AUTH_ROLES_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_ROLE_KEY);
}

export function hasRole(role: string) {
  return getAuthenticatedRoles().includes(role);
}

export function isPlatformAdmin() {
  return hasRole(PLATFORM_ADMIN_ROLE);
}

export function isEmployee() {
  return hasRole(EMPLOYEE_ROLE);
}

export function isClient() {
  return hasRole(CLIENT_ROLE);
}

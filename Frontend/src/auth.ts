export const PLATFORM_ADMIN_ROLE = "platform admin";
const AUTH_ROLE_KEY = "blueprint.auth.role";

export function getAuthenticatedRole() {
  return sessionStorage.getItem(AUTH_ROLE_KEY);
}

export function setAuthenticatedRole(role: string) {
  sessionStorage.setItem(AUTH_ROLE_KEY, role);
}

export function clearAuthenticatedRole() {
  sessionStorage.removeItem(AUTH_ROLE_KEY);
}

export function isPlatformAdmin() {
  return getAuthenticatedRole() === PLATFORM_ADMIN_ROLE;
}

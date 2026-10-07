export type ApplicationEnvironment = "development" | "testing" | "production";

export const APPLICATION_ENVIRONMENT_KEY = "blueprint.application.environment";

export function normalizeApplicationEnvironment(value: unknown): ApplicationEnvironment {
  return value === "development" || value === "testing" || value === "production"
    ? value
    : "production";
}

export function getApplicationEnvironment(): ApplicationEnvironment {
  return normalizeApplicationEnvironment(sessionStorage.getItem(APPLICATION_ENVIRONMENT_KEY));
}

export function setApplicationEnvironment(value: unknown) {
  sessionStorage.setItem(APPLICATION_ENVIRONMENT_KEY, normalizeApplicationEnvironment(value));
}

export function clearApplicationEnvironment() {
  sessionStorage.removeItem(APPLICATION_ENVIRONMENT_KEY);
}

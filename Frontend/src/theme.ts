export type ThemePreference = "light" | "dark" | "dynamic";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCE_CACHE_KEY = "blueprint.theme.preference";

const LIGHT_START_HOUR = 7;
const DARK_START_HOUR = 19;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "dynamic";
}

export function resolveTheme(
  preference: ThemePreference,
  now = new Date(),
): ResolvedTheme {
  if (preference !== "dynamic") return preference;
  const hour = now.getHours();
  return hour >= LIGHT_START_HOUR && hour < DARK_START_HOUR ? "light" : "dark";
}

export function millisecondsUntilNextBoundary(now = new Date()) {
  const next = new Date(now);
  if (now.getHours() < LIGHT_START_HOUR) {
    next.setHours(LIGHT_START_HOUR, 0, 0, 0);
  } else if (now.getHours() < DARK_START_HOUR) {
    next.setHours(DARK_START_HOUR, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(LIGHT_START_HOUR, 0, 0, 0);
  }
  return Math.max(1, next.getTime() - now.getTime());
}

export function applyThemePreference(
  preference: ThemePreference,
  now = new Date(),
) {
  const resolved = resolveTheme(preference, now);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function readCachedThemePreference(): ThemePreference {
  const cached = sessionStorage.getItem(THEME_PREFERENCE_CACHE_KEY);
  return isThemePreference(cached) ? cached : "light";
}

export function cacheThemePreference(preference: ThemePreference) {
  sessionStorage.setItem(THEME_PREFERENCE_CACHE_KEY, preference);
}

export function clearCachedThemePreference() {
  sessionStorage.removeItem(THEME_PREFERENCE_CACHE_KEY);
}

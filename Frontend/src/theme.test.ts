import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemePreference,
  millisecondsUntilNextBoundary,
  resolveTheme,
} from "./theme";

afterEach(() => {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
});

describe("dynamic theme", () => {
  it.each([
    [new Date(2026, 8, 3, 6, 59), "dark"],
    [new Date(2026, 8, 3, 7, 0), "light"],
    [new Date(2026, 8, 3, 18, 59), "light"],
    [new Date(2026, 8, 3, 19, 0), "dark"],
  ] as const)("resolves the local boundary at %s", (now, expected) => {
    expect(resolveTheme("dynamic", now)).toBe(expected);
  });

  it("calculates the next transition and applies browser colour scheme", () => {
    const beforeNight = new Date(2026, 8, 3, 18, 59, 59);
    expect(millisecondsUntilNextBoundary(beforeNight)).toBe(1000);
    expect(applyThemePreference("dynamic", beforeNight)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    const atNight = new Date(2026, 8, 3, 19, 0);
    expect(millisecondsUntilNextBoundary(atNight)).toBe(12 * 60 * 60 * 1000);
    expect(applyThemePreference("dynamic", atNight)).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import {
  APPLICATION_ENVIRONMENT_KEY,
  getApplicationEnvironment,
  normalizeApplicationEnvironment,
} from "./environment";
import { getMockFeatureState } from "./mockFeatures";

afterEach(() => sessionStorage.clear());

describe("application environment", () => {
  it.each([
    ["development", "development", "available"],
    ["testing", "testing", "disabled"],
    ["production", "production", "hidden"],
    [null, "production", "hidden"],
    ["staging", "production", "hidden"],
  ])("maps %s to a safe mock-feature state", (value, environment, state) => {
    if (value !== null) sessionStorage.setItem(APPLICATION_ENVIRONMENT_KEY, value);

    expect(getApplicationEnvironment()).toBe(environment);
    expect(getMockFeatureState()).toBe(state);
  });

  it("normalizes unknown values to production", () => {
    expect(normalizeApplicationEnvironment("Development")).toBe("production");
  });
});

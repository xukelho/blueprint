import { getApplicationEnvironment } from "./environment";

export type MockFeatureState = "available" | "disabled" | "hidden";

export function getMockFeatureState(): MockFeatureState {
  switch (getApplicationEnvironment()) {
    case "development":
      return "available";
    case "testing":
      return "disabled";
    default:
      return "hidden";
  }
}

export function isMockFeatureVisible() {
  return getMockFeatureState() !== "hidden";
}

export function isMockFeatureDisabled() {
  return getMockFeatureState() === "disabled";
}

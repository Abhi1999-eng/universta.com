import { describe, expect, it } from "vitest";
import { nextAutoSlug, slugFromText } from "./slug";

describe("slugFromText", () => {
  it("normalizes an editor-facing name", () => {
    expect(slugFromText("Westbridge University London")).toBe("westbridge-university-london");
  });
});

it("preserves manual and existing slugs", () => {
  expect(nextAutoSlug({ sourceValue: "New name", currentSlug: "custom-url", existingRecord: false, manuallyOverridden: true })).toBe("custom-url");
  expect(nextAutoSlug({ sourceValue: "New name", currentSlug: "stable-url", existingRecord: true, manuallyOverridden: false })).toBe("stable-url");
});

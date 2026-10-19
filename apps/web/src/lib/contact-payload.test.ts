import { describe, expect, it } from "vitest";
import { contactPayload, prefilledSubject, SUBJECT_PREFILL_MAX } from "./contact-payload";

describe("contactPayload", () => {
  it("serializes the required privacy checkbox as the API boolean contract", () => {
    const form = new FormData();
    form.set("fullName", "Fictional local user");
    form.set("privacyConsent", "true");

    expect(contactPayload(form)).toMatchObject({
      fullName: "Fictional local user",
      privacyConsent: true,
    });
  });
});

describe("prefilledSubject (JOB-C4-web)", () => {
  it("keeps a role page's subject as given", () => {
    expect(prefilledSubject("Role: Admissions analyst")).toBe("Role: Admissions analyst");
    expect(prefilledSubject(["Role: First", "Role: Second"])).toBe("Role: First");
  });

  it("makes anything else one short plain line, or nothing", () => {
    expect(prefilledSubject("  Role:\n\t<b>Analyst</b>\u0000 ")).toBe("Role: Analyst");
    expect(prefilledSubject("x".repeat(400))).toHaveLength(SUBJECT_PREFILL_MAX);
    expect(prefilledSubject("   ")).toBeNull();
    expect(prefilledSubject(undefined)).toBeNull();
  });
});

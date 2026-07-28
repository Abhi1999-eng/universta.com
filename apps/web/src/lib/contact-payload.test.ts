import { describe, expect, it } from "vitest";
import { contactPayload } from "./contact-payload";

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

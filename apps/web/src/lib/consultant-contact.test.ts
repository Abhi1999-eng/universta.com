import { describe, expect, it } from "vitest";
import { consultantContactActions } from "./consultant-contact";

describe("consultantContactActions", () => {
  it("keeps Horizon Study Advisors contact actions with the consultant", () => {
    expect(
      consultantContactActions({
        email: "hello@horizon-demo.test",
        phone: "+1 555 014 2211",
      }),
    ).toEqual([
      {
        label: "Contact Consultant",
        href: "mailto:hello@horizon-demo.test",
        primary: true,
      },
      { label: "Call", href: "tel:+1 555 014 2211" },
      { label: "Email", href: "mailto:hello@horizon-demo.test" },
    ]);
  });

  it("does not render dead contact actions when details are absent", () => {
    expect(consultantContactActions({})).toEqual([]);
    expect(consultantContactActions({ phone: "  +91 555 0000  " })).toEqual([
      { label: "Call", href: "tel:+91 555 0000" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { phaseOneMetadata } from "./phase1-metadata";

describe("phaseOneMetadata", () => {
  it("makes a published Phase 1 detail URL canonical and shareable", () => {
    expect(
      phaseOneMetadata(
        { title: "Fictional demo scholarship", summary: "Local demo content." },
        "/scholarships/fictional-demo-scholarship",
        "Scholarship",
      ),
    ).toMatchObject({
      title: "Fictional demo scholarship | Universta",
      description: "Local demo content.",
      alternates: { canonical: "/scholarships/fictional-demo-scholarship" },
      robots: { index: true, follow: true },
      openGraph: {
        title: "Fictional demo scholarship",
        url: "/scholarships/fictional-demo-scholarship",
      },
    });
  });
});

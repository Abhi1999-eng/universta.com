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

  it("prefers admin-configured SeoMetadata over the record's own fields", () => {
    expect(
      phaseOneMetadata(
        {
          title: "Fictional demo scholarship",
          summary: "Local demo content.",
          seo: {
            seoTitle: "Custom SEO title",
            metaDescription: "Custom SEO description.",
            canonicalUrl: "/scholarships/custom-canonical",
            robotsIndex: false,
            robotsFollow: false,
          },
        },
        "/scholarships/fictional-demo-scholarship",
        "Scholarship",
      ),
    ).toMatchObject({
      title: "Custom SEO title | Universta",
      description: "Custom SEO description.",
      alternates: { canonical: "/scholarships/custom-canonical" },
      robots: { index: false, follow: false },
      openGraph: {
        title: "Custom SEO title",
        url: "/scholarships/custom-canonical",
      },
    });
  });
});

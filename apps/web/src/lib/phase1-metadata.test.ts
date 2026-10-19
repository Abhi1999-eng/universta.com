import { describe, expect, it } from "vitest";
import { phaseOneMetadata } from "./phase1-metadata";
import { siteOrigin } from "./site-origin";

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
      alternates: {
        canonical: new URL("/scholarships/fictional-demo-scholarship", siteOrigin).toString(),
      },
      robots: { index: true, follow: true },
      openGraph: {
        title: "Fictional demo scholarship",
        url: new URL("/scholarships/fictional-demo-scholarship", siteOrigin).toString(),
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
      alternates: {
        canonical: new URL("/scholarships/custom-canonical", siteOrigin).toString(),
      },
      robots: { index: false, follow: false },
      openGraph: {
        title: "Custom SEO title",
        url: new URL("/scholarships/custom-canonical", siteOrigin).toString(),
      },
    });
  });
});

/** SS-C6, EV-C7, JOB-C6, CON-C7. The resolver ranks the site's generic
 * description above a record's own summary and marks it `default`; every
 * story, event, role and consultant shared that one sentence. */
describe("phaseOneMetadata -- the record's own description", () => {
  const generic = "Explore published study-abroad courses, universities, destinations and scholarships on Universta.";
  const resolved = (source: Record<string, string>) => ({
    seoTitle: "Resolved title",
    metaDescription: generic,
    canonicalUrl: "/careers/old-slug",
    ogDescription: generic,
    twitterDescription: generic,
    ogMedia: { url: "https://cdn.example.test/event.jpg", alt: "Event" },
    robotsIndex: true,
    robotsFollow: true,
    source,
  });

  it("uses the summary when the description is only the site default", () => {
    const metadata = phaseOneMetadata(
      {
        title: "Senior counselling specialist",
        summary: "Guide students through applications to universities in Japan.",
        seo: resolved({ title: "fallback", description: "default", canonical: "fallback" }),
      },
      "/careers/senior-counselling-specialist-0",
      "Career",
    );
    expect(metadata.description).toBe("Guide students through applications to universities in Japan.");
    expect(metadata.openGraph?.description).toBe("Guide students through applications to universities in Japan.");
    expect(metadata.twitter?.description).toBe("Guide students through applications to universities in Japan.");
    expect(metadata.title).toBe("Senior counselling specialist | Universta");
    /* A fallback canonical is the page's own address, never a stale one. */
    expect(metadata.alternates?.canonical).toBe(
      new URL("/careers/senior-counselling-specialist-0", siteOrigin).toString(),
    );
    /* Images pass through: an event's featured image reaches the share card. */
    expect(metadata.openGraph?.images).toEqual([{ url: "https://cdn.example.test/event.jpg", alt: "Event" }]);
  });

  it("keeps a description an editor wrote", () => {
    const metadata = phaseOneMetadata(
      {
        title: "Open day",
        summary: "The summary.",
        seo: { ...resolved({ title: "manual", description: "manual", canonical: "manual" }), metaDescription: "Written by hand." },
      },
      "/events/open-day",
      "Event",
    );
    expect(metadata.description).toBe("Written by hand.");
    expect(metadata.title).toBe("Resolved title | Universta");
  });

  it("takes a plain, variable-resolved excerpt of about 155 characters from a story's journey", () => {
    const journey =
      "<p>At {universityName} I learnt that applying early mattered &amp; that every document took longer than planned.</p>" +
      "<p>Visa appointments filled quickly, so I booked one the week my offer arrived and kept copies of everything I sent.</p>";
    const metadata = phaseOneMetadata(
      {
        title: "From Pune to Tokyo",
        journey,
        university: { name: "The University of Tokyo" },
        seo: resolved({ title: "fallback", description: "default" }),
      } as never,
      "/success-stories/from-pune-to-tokyo",
      "Success story",
      "successStory",
    );
    const description = String(metadata.description);
    expect(description.startsWith("At The University of Tokyo I learnt that applying early mattered & that")).toBe(true);
    expect(description).not.toMatch(/[<>{}]/);
    expect(description.length).toBeLessThanOrEqual(155);
    expect(description.endsWith("…")).toBe(true);
  });

  it("treats a stored SEO row with no source as hand-written (consultant locations)", () => {
    const metadata = phaseOneMetadata(
      {
        name: "Mumbai",
        seo: { seoTitle: "Consultants in Mumbai", metaDescription: "Study abroad consultants with an office in Mumbai." },
      },
      "/study-abroad-consultants/locations/mumbai",
      "Consultant location",
    );
    expect(metadata.title).toBe("Consultants in Mumbai | Universta");
    expect(metadata.description).toBe("Study abroad consultants with an office in Mumbai.");
  });

  it("skips an empty rich-text field for the next one that says something", () => {
    const metadata = phaseOneMetadata(
      { title: "Role", summary: "<p><br></p>", description: "<p>Help students plan.</p>" },
      "/careers/role",
      "Career",
    );
    expect(metadata.description).toBe("Help students plan.");
  });
});

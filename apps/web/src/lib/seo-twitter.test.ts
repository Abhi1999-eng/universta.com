import { describe, expect, it } from "vitest";
import { resolvedMetadata } from "./seo-management";

/**
 * Next.js derives a Twitter card from Open Graph when no `twitter` block is
 * given, so the dedicated Twitter fields an editor fills in never reached the
 * page: `twitter:title` rendered the Open Graph title instead.
 */
describe("resolvedMetadata — Twitter card", () => {
  const base = {
    seoTitle: "Seo title",
    metaDescription: "Seo description",
    ogTitle: "OG title",
    ogDescription: "OG description",
  };

  it("uses the explicit Twitter values when they are set", () => {
    const meta = resolvedMetadata(
      {
        ...base,
        twitterTitle: "Twitter title",
        twitterDescription: "Twitter description",
      },
      "Fallback",
      "Fallback description",
      "/countries/demo",
    );
    expect(meta.twitter).toMatchObject({
      title: "Twitter title",
      description: "Twitter description",
    });
    // ...and Open Graph keeps its own, so the two are not conflated.
    expect(meta.openGraph).toMatchObject({
      title: "OG title",
      description: "OG description",
    });
  });

  it("falls back to Open Graph when no Twitter value is set", () => {
    const meta = resolvedMetadata(base, "Fallback", "Fallback description", "/x");
    expect(meta.twitter).toMatchObject({
      title: "OG title",
      description: "OG description",
    });
  });

  it("falls back to the page title when neither is set", () => {
    const meta = resolvedMetadata(null, "Fallback", "Fallback description", "/x");
    expect(meta.twitter).toMatchObject({
      title: "Fallback",
      description: "Fallback description",
    });
  });
});

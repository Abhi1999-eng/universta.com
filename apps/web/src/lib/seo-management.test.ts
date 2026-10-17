import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteCanonical, resolvedMetadata, siteVerificationMetadata, writtenSeo } from "./seo-management";

afterEach(() => vi.unstubAllGlobals());

describe("resolvedMetadata", () => {
  it("renders the resolved manual/bulk output and configured suffix into document metadata", () => {
    expect(
      resolvedMetadata(
        {
          seoTitle: "Study at Demo University",
          metaDescription: "Resolved from bulk SEO.",
          canonicalUrl: "/universities/demo-university",
          robotsIndex: true,
          robotsFollow: true,
          titleSuffix: "| Universta",
          ogTitle: "Demo University",
        },
        "Fallback",
        "Fallback description",
        "/fallback",
      ),
    ).toMatchObject({
      title: "Study at Demo University | Universta",
      description: "Resolved from bulk SEO.",
      alternates: { canonical: "http://localhost:3000/universities/demo-university" },
      openGraph: { title: "Demo University" },
    });
  });
});

describe('absoluteCanonical', () => {
  it('resolves a stored site path against the configured public origin', () => {
    expect(absoluteCanonical('/countries/poland', 'https://example.test')).toBe('https://example.test/countries/poland');
  });

  it('keeps an intentional absolute canonical unchanged', () => {
    expect(absoluteCanonical('https://example.com/countries/poland', 'https://example.test')).toBe('https://example.com/countries/poland');
  });
});

describe("siteVerificationMetadata", () => {
  it("returns a Google verification metadata value, not arbitrary HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { google: "google-token-123" } }),
      }),
    );
    await expect(siteVerificationMetadata()).resolves.toEqual({
      verification: { google: "google-token-123" },
    });
  });
});

describe("writtenSeo", () => {
  const seo = {
    seoTitle: "Computing degrees",
    metaDescription: "What a Computing degree involves.",
    canonicalUrl: "/subjects/computing/degrees",
    ogTitle: "OG title",
    ogDescription: "OG description",
    twitterTitle: "Twitter title",
    twitterDescription: "Twitter description",
    ogMedia: { url: "https://cdn.test/og.png", alt: "Students" },
    robotsIndex: false,
    robotsFollow: true,
    titleSuffix: "| Universta",
  };

  it("keeps what an editor or a bulk template wrote", () => {
    expect(writtenSeo({ ...seo, source: { title: "manual", description: "bulk", canonical: "manual" } })).toEqual({
      ...seo,
      source: { title: "manual", description: "bulk", canonical: "manual" },
    });
  });

  it("drops what the resolver made up, and keeps images, robots and the suffix", () => {
    const own = writtenSeo({ ...seo, source: { title: "fallback", description: "default", canonical: "fallback" } })!;
    expect(own.seoTitle).toBeUndefined();
    expect(own.ogTitle).toBeNull();
    expect(own.twitterTitle).toBeNull();
    expect(own.metaDescription).toBeUndefined();
    expect(own.ogDescription).toBeNull();
    expect(own.twitterDescription).toBeNull();
    expect(own.canonicalUrl).toBeNull();
    expect(own.ogMedia).toEqual(seo.ogMedia);
    expect(own.robotsIndex).toBe(false);
    expect(own.titleSuffix).toBe("| Universta");
  });

  it("treats a canonical from an older API, which names no source, as not written", () => {
    expect(writtenSeo({ ...seo, source: { title: "manual", description: "manual" } })!.canonicalUrl).toBeNull();
  });

  it("is nothing for nothing", () => {
    expect(writtenSeo(null)).toBeNull();
    expect(writtenSeo(undefined)).toBeNull();
  });
});

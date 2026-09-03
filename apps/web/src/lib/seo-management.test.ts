import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteCanonical, resolvedMetadata, siteVerificationMetadata } from "./seo-management";

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

import { afterEach, describe, expect, it, vi } from "vitest";
import { siteOrigin } from "./site-origin";
import { staticPageMetadata } from "./static-page-seo";

/** ISS-038. The admin's "Default SEO" settings screen's "Default title
 * suffix" field promised a fallback used "when a page has no SEO of its
 * own", but every page hardcoded "| Universta" regardless of the setting.
 * This confirms staticPageMetadata now reads the actual configured suffix,
 * and falls back to the historical "| Universta" when settings are
 * unreachable or the field is blank -- so a fetch failure never breaks a
 * page's title outright. */

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: async () => ({ data }) } as Response;
}

function mockFetch(staticSeo: unknown, settingsSeo: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/static-page-seo/"))
        return Promise.resolve(jsonResponse(staticSeo));
      if (url.includes("/seo-management/defaults"))
        return Promise.resolve(jsonResponse(settingsSeo));
      return Promise.resolve(jsonResponse(null, false));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("staticPageMetadata -- default title suffix (ISS-038)", () => {
  it("uses the admin-configured default title suffix when no per-page SEO overrides it", async () => {
    mockFetch(null, { defaultTitleSuffix: "| My Custom Suffix" });
    const metadata = await staticPageMetadata(
      "home",
      "Fallback Title",
      "Fallback description.",
      "/",
    );
    expect(metadata.title).toBe("Fallback Title | My Custom Suffix");
  });

  it("falls back to the historical suffix when the settings fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const metadata = await staticPageMetadata(
      "home",
      "Fallback Title",
      "Fallback description.",
      "/",
    );
    expect(metadata.title).toBe("Fallback Title | Universta");
  });

  it("falls back to the historical suffix when the setting is blank", async () => {
    mockFetch(null, { defaultTitleSuffix: "" });
    const metadata = await staticPageMetadata(
      "home",
      "Fallback Title",
      "Fallback description.",
      "/",
    );
    expect(metadata.title).toBe("Fallback Title | Universta");
  });
});

/** SS-C10. The site's default description outranked each page's own, so
 * /events, /careers, /success-stories, /courses and the rest all carried the
 * same sentence; and their canonical and og:url were relative. */
describe("staticPageMetadata -- description order and canonical (SS-C10)", () => {
  const defaults = {
    defaultTitleSuffix: "| Universta",
    defaultDescription: "The site-wide default description.",
  };
  const stored = (values: Record<string, unknown>) => ({
    seoTitle: "Page",
    metaDescription: "",
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    ogMedia: null,
    robotsIndex: true,
    robotsFollow: true,
    ...values,
  });

  it("prints the page's own description ahead of the site default", async () => {
    mockFetch(null, defaults);
    const metadata = await staticPageMetadata(
      "events-listing",
      "Events",
      "Explore currently published Universta events and info sessions.",
      "/events",
    );
    expect(metadata.description).toBe(
      "Explore currently published Universta events and info sessions.",
    );
    expect(metadata.openGraph?.description).toBe(
      "Explore currently published Universta events and info sessions.",
    );
  });

  it("keeps an editor's own description ahead of both", async () => {
    mockFetch(stored({ metaDescription: "Written in the admin." }), defaults);
    const metadata = await staticPageMetadata(
      "events-listing",
      "Events",
      "The page's own sentence.",
      "/events",
    );
    expect(metadata.description).toBe("Written in the admin.");
  });

  it("falls back to the site default only for a page with no sentence of its own", async () => {
    mockFetch(null, defaults);
    const metadata = await staticPageMetadata("home", "Home", "", "/");
    expect(metadata.description).toBe("The site-wide default description.");
  });

  it("publishes an absolute canonical and og:url", async () => {
    mockFetch(null, defaults);
    const metadata = await staticPageMetadata(
      "success-stories-listing",
      "Success stories",
      "Stories.",
      "/success-stories",
    );
    const expected = new URL("/success-stories", siteOrigin).toString();
    expect(metadata.alternates?.canonical).toBe(expected);
    expect((metadata.openGraph as { url?: string } | undefined)?.url).toBe(expected);
  });

  it("makes a stored relative canonical absolute too", async () => {
    mockFetch(stored({ metaDescription: "Roles.", canonicalUrl: "/careers" }), defaults);
    const metadata = await staticPageMetadata("careers-listing", "Careers", "Roles.", "/jobs");
    expect(metadata.alternates?.canonical).toBe(new URL("/careers", siteOrigin).toString());
  });
});

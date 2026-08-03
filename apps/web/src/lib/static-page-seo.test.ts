import { afterEach, describe, expect, it, vi } from "vitest";
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
      if (url.includes("/static-page-seo/")) return Promise.resolve(jsonResponse(staticSeo));
      if (url.includes("/settings")) return Promise.resolve(jsonResponse({ seo: settingsSeo }));
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
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const originalAdminOrigin = process.env.ADMIN_APP_ORIGIN;

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: async () => ({ data }) } as Response;
}

beforeEach(() => {
  // No redirect configured, by default -- individual tests override this.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));
});

afterEach(() => {
  if (originalAdminOrigin === undefined) delete process.env.ADMIN_APP_ORIGIN;
  else process.env.ADMIN_APP_ORIGIN = originalAdminOrigin;
  vi.unstubAllGlobals();
});

describe("public framing policy", () => {
  it("denies framing on normal public routes", async () => {
    const response = await middleware(
      new NextRequest("https://example.test/countries"),
    );

    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("allows only the configured Admin origin to frame draft preview", async () => {
    process.env.ADMIN_APP_ORIGIN = "https://admin.example.test";

    const response = await middleware(
      new NextRequest("https://example.test/preview?slug=home&token=test"),
    );

    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self' https://admin.example.test",
    );
  });
});

/** ISS-033. Redirects created through the admin previously had no effect at
 * all on the live site -- these pin that middleware actually enforces one. */
describe("admin-configured redirects", () => {
  it("issues a real redirect when the path matches an active redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ targetPath: "/countries", httpStatusCode: 301 }),
      ),
    );

    const response = await middleware(
      new NextRequest("https://example.test/old-path"),
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://example.test/countries");
  });

  it("respects the configured status code (e.g. a temporary 302)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ targetPath: "/universities", httpStatusCode: 302 }),
      ),
    );

    const response = await middleware(
      new NextRequest("https://example.test/temp-path"),
    );

    expect(response.status).toBe(302);
  });

  it("falls through to the normal response when no redirect matches", async () => {
    const response = await middleware(
      new NextRequest("https://example.test/countries"),
    );

    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("falls through when the redirect lookup fails or times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const response = await middleware(
      new NextRequest("https://example.test/countries"),
    );

    expect(response.status).not.toBe(301);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});

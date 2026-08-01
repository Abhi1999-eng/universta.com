import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const originalAdminOrigin = process.env.ADMIN_APP_ORIGIN;

afterEach(() => {
  if (originalAdminOrigin === undefined) delete process.env.ADMIN_APP_ORIGIN;
  else process.env.ADMIN_APP_ORIGIN = originalAdminOrigin;
});

describe("public framing policy", () => {
  it("denies framing on normal public routes", () => {
    const response = middleware(
      new NextRequest("https://example.test/countries"),
    );

    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBeNull();
  });

  it("allows only the configured Admin origin to frame draft preview", () => {
    process.env.ADMIN_APP_ORIGIN = "https://admin.example.test";

    const response = middleware(
      new NextRequest("https://example.test/preview?slug=home&token=test"),
    );

    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBe(
      "frame-ancestors 'self' https://admin.example.test",
    );
  });
});

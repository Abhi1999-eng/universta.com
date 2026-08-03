import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "universta_ab";
const BOT_ANONYMOUS_ID = "bot";
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|googlebot|ahrefsbot|semrushbot|mj12bot|petalbot/i;
const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

/** ISS-033. The admin's Redirects screen (create, validate, enable/disable,
 * hit-count tracking) was fully built, and the API side of consuming it
 * (`ExpandedService.resolveRedirect`, exposed at `GET /phase1/redirects`)
 * already existed too -- but nothing on the public site ever CALLED that
 * endpoint. A configured redirect had zero effect; the source path just
 * 404'd like any other nonexistent route. This is the one call site that
 * makes a saved redirect actually redirect. A short timeout and a swallowed
 * failure both fall through to "no redirect" rather than blocking or
 * breaking a page load if the API is slow or unreachable. */
async function findRedirect(
  pathname: string,
): Promise<{ targetPath: string; httpStatusCode: number } | null> {
  try {
    const response = await fetch(
      new URL(
        `/api/v1/phase1/redirects?path=${encodeURIComponent(pathname)}`,
        API_BASE_URL,
      ),
      { signal: AbortSignal.timeout(1500) },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { targetPath: string; httpStatusCode: number } | null };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Assigns (and persists) a stable anonymous id for A/B test variant
 * assignment. The id is forwarded as a request header so the same request's
 * Server Components can read it via `headers()` before the Set-Cookie takes
 * effect on the client. Detected crawlers get the fixed "bot" sentinel
 * instead of a real id, so search engines always see the canonical control
 * variant and are never counted as an exposure.
 */
export async function middleware(request: NextRequest) {
  const redirectMatch = await findRedirect(request.nextUrl.pathname);
  if (redirectMatch) {
    return NextResponse.redirect(
      new URL(redirectMatch.targetPath, request.url),
      redirectMatch.httpStatusCode,
    );
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const isBot = BOT_PATTERN.test(userAgent);
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const anonymousId = isBot ? BOT_ANONYMOUS_ID : (existing ?? crypto.randomUUID());

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-anon-id", anonymousId);
  // The root layout renders the one Header/Footer for every route but, in the
  // App Router, a layout cannot read the pathname. Forwarding it here is what
  // lets the layout ask the API for that route's chrome override.
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (request.nextUrl.pathname === "/preview") {
    const configuredAdminOrigin = process.env.ADMIN_APP_ORIGIN;
    const adminOrigin = configuredAdminOrigin ?? (
      request.nextUrl.hostname === "localhost"
        ? "http://localhost:3001"
        : `${request.nextUrl.protocol}//admin.${request.nextUrl.hostname}${request.nextUrl.port ? `:${request.nextUrl.port}` : ""}`
    );
    response.headers.set(
      "Content-Security-Policy",
      `frame-ancestors 'self' ${adminOrigin}`,
    );
  } else {
    // Draft preview is intentionally framed by the Admin origin above. Every
    // other public document rejects framing to prevent clickjacking.
    response.headers.set("X-Frame-Options", "DENY");
  }
  if (!isBot && !existing) {
    response.cookies.set(COOKIE_NAME, anonymousId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};

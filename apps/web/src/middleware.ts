import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "universta_ab";
const BOT_ANONYMOUS_ID = "bot";
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|googlebot|ahrefsbot|semrushbot|mj12bot|petalbot/i;

/**
 * Assigns (and persists) a stable anonymous id for A/B test variant
 * assignment. The id is forwarded as a request header so the same request's
 * Server Components can read it via `headers()` before the Set-Cookie takes
 * effect on the client. Detected crawlers get the fixed "bot" sentinel
 * instead of a real id, so search engines always see the canonical control
 * variant and are never counted as an exposure.
 */
export function middleware(request: NextRequest) {
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

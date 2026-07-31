import { NextResponse, type NextRequest } from 'next/server';
import { checkAdminSession } from '@/lib/server/session';

const protectedPaths = [
  '/dashboard',
  '/continents',
  '/countries',
  '/courses',
  '/subjects',
  '/catalog-masters',
  '/leads',
  '/phase1',
];

/** Navigation guard for protected Admin routes.
 *
 * This is a routing convenience, not the security boundary: every page's own
 * data fetch is authenticated by the API independently, and nothing renders
 * from a request the API refuses. Treating it as the boundary is what made the
 * previous version destructive -- it deleted both auth cookies whenever one
 * validation failed, which turned an ordinary in-flight token rotation into a
 * full logout:
 *
 *   navigation starts, reads cookie A
 *   a parallel authFetch hits 401, refreshes, rotates A into B
 *   this guard validates A, now revoked, and deletes A *and* B
 *
 * The browser was holding a perfectly good B at that moment. So the guard no
 * longer deletes cookies at all. Ending a session is logout's job, and logout
 * revokes the token server-side and clears the cookie from the API's own
 * response. The worst this can now do is redirect someone to a login page they
 * did not need -- and the API's bounded rotation grace means even that does not
 * happen to a request that merely raced a refresh. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    !protectedPaths.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }
  const cookieName =
    process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  const refreshToken = request.cookies.get(cookieName)?.value;
  const status = await checkAdminSession(refreshToken);

  // An API that could not answer has not said the session is over. Continuing
  // costs nothing -- the page's own authenticated fetches still have to succeed
  // -- whereas redirecting would log out every admin during a restart or a
  // network blip.
  if (status === 'valid' || status === 'indeterminate') {
    return NextResponse.next();
  }

  const login = new URL('/login', request.url);
  login.searchParams.set('returnTo', `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };

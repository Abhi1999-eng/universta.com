import { NextResponse, type NextRequest } from 'next/server';

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

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!protectedPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  if (request.cookies.has(cookieName)) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('returnTo', `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };

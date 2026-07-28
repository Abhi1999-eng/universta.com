import { NextResponse, type NextRequest } from 'next/server';
import { hasValidAdminSession } from '@/lib/server/session';

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

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!protectedPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  const refreshToken = request.cookies.get(cookieName)?.value;
  if (await hasValidAdminSession(refreshToken)) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('returnTo', `${path}${request.nextUrl.search}`);
  const response = NextResponse.redirect(login);
  response.cookies.delete({ name: cookieName, path: '/' });
  response.cookies.delete({ name: cookieName, path: '/api/v1/admin/auth' });
  return response;
}

export const config = { matcher: ['/((?!api|_next|favicon.ico).*)'] };

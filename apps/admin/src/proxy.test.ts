// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { SessionStatus } from '@/lib/server/session';

const checkAdminSession = vi.fn<() => Promise<SessionStatus>>();
vi.mock('@/lib/server/session', () => ({ checkAdminSession }));

const { proxy } = await import('./proxy');

const COOKIE = 'universta_admin_refresh';

function navigate(path: string, token: string | undefined = 'token-a') {
  const request = new NextRequest(new URL(`http://admin.local${path}`));
  if (token) request.cookies.set(COOKIE, token);
  return proxy(request);
}

/** Cookies the middleware asked the browser to drop.
 *
 * Next encodes a deletion as a Set-Cookie with an empty value, so an assertion
 * on "did it delete anything" has to read the header rather than trust the
 * absence of a call. */
function deletedCookies(response: Response): string[] {
  return response.headers
    .getSetCookie()
    .filter((header) => /^[^=]+=;/.test(header) || /Max-Age=0/.test(header));
}

beforeEach(() => {
  checkAdminSession.mockReset();
});

describe('protected-route guard', () => {
  it('lets a valid session through', async () => {
    checkAdminSession.mockResolvedValue('valid');
    const response = await navigate('/dashboard');
    expect(response.status).toBe(200);
  });

  it('redirects an invalid session to login, preserving where it was going', async () => {
    checkAdminSession.mockResolvedValue('invalid');
    const response = await navigate('/leads');
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('returnTo')).toBe('/leads');
  });

  it('never deletes auth cookies, even when it redirects', async () => {
    // The regression that caused the logouts. The middleware used to delete
    // both cookies here; if the failure was a rotation race, the cookie it
    // deleted was the *new*, valid one the API had just issued.
    checkAdminSession.mockResolvedValue('invalid');
    const response = await navigate('/dashboard');
    expect(deletedCookies(response)).toEqual([]);
  });

  it('continues when the API could not answer, rather than logging everyone out', async () => {
    // A restart or a network blip says nothing about whether the session is
    // valid. The page's own authenticated fetches remain the real gate.
    checkAdminSession.mockResolvedValue('indeterminate');
    const response = await navigate('/dashboard');
    expect(response.status).toBe(200);
    expect(deletedCookies(response)).toEqual([]);
  });

  it('redirects when no cookie is present at all', async () => {
    checkAdminSession.mockResolvedValue('invalid');
    const response = await navigate('/dashboard', undefined);
    expect(response.status).toBe(307);
  });

  it('leaves unprotected routes alone without consulting the API', async () => {
    const response = await navigate('/login', undefined);
    expect(response.status).toBe(200);
    expect(checkAdminSession).not.toHaveBeenCalled();
  });

  it('does not redirect the login page to itself', async () => {
    // A guard that protected /login would bounce forever once a session ended.
    checkAdminSession.mockResolvedValue('invalid');
    const response = await navigate('/login');
    expect(response.status).toBe(200);
  });

  it('keeps several simultaneous navigations independent', async () => {
    checkAdminSession.mockResolvedValue('valid');
    const responses = await Promise.all([
      navigate('/dashboard'),
      navigate('/leads'),
      navigate('/countries'),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(responses.flatMap(deletedCookies)).toEqual([]);
  });

  it('does not end the session when one tab of several fails validation', async () => {
    // Tab A raced a rotation and lost; tabs B and C are fine. A must not take
    // the others down with it, which is exactly what deleting cookies did.
    checkAdminSession
      .mockResolvedValueOnce('invalid')
      .mockResolvedValue('valid');
    const [first, ...rest] = await Promise.all([
      navigate('/dashboard'),
      navigate('/leads'),
      navigate('/countries'),
    ]);
    expect(first.status).toBe(307);
    expect(rest.map((response) => response.status)).toEqual([200, 200]);
    expect([first, ...rest].flatMap(deletedCookies)).toEqual([]);
  });

  it('guards nested paths under a protected prefix', async () => {
    checkAdminSession.mockResolvedValue('invalid');
    const response = await navigate('/countries/canada/edit');
    expect(response.status).toBe(307);
  });

  it('carries the query string into returnTo', async () => {
    checkAdminSession.mockResolvedValue('invalid');
    const request = new NextRequest(
      new URL('http://admin.local/leads?page=3&status=NEW'),
    );
    request.cookies.set(COOKIE, 'token-a');
    const response = await proxy(request);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.get('returnTo')).toBe(
      '/leads?page=3&status=NEW',
    );
  });
});

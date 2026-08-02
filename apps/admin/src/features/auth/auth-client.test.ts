import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authFetch,
  clearAuthenticatedSession,
  getAccessToken,
  getCurrentUser,
  getSessionGeneration,
  login,
  refreshSession,
  setAuthenticatedSession,
} from './auth-client';

const user = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: null,
  roles: ['SUPER_ADMIN'],
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data, meta: null, error: null, requestId: 'request-1', timestamp: new Date().toISOString() }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(code: string, status: number) {
  return new Response(JSON.stringify({ data: null, meta: null, error: { code, message: 'unsafe backend detail', details: null }, requestId: 'request-2', timestamp: new Date().toISOString() }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('memory-only admin auth client', () => {
  beforeEach(() => {
    clearAuthenticatedSession();
    vi.restoreAllMocks();
  });

  it('stores the access token in memory and never localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ accessToken: 'access-1', tokenType: 'Bearer', expiresIn: 900, user }));
    vi.stubGlobal('fetch', fetchMock);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await login(' ADMIN@EXAMPLE.COM ', ' password ');
    expect(getAccessToken()).toBe('access-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/admin/auth/login');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ email: 'admin@example.com', password: ' password ' });
    expect(setItem).not.toHaveBeenCalled();
  });

  it('refreshes the session and then gets the current user', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ accessToken: 'access-2', tokenType: 'Bearer', expiresIn: 900, user }))
      .mockResolvedValueOnce(response({ user }));
    vi.stubGlobal('fetch', fetchMock);
    const token = await refreshSession();
    const current = await getCurrentUser(token);
    expect(token).toBe('access-2');
    expect(current).toEqual(user);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ authorization: 'Bearer access-2' });
  });

  it('marks refresh failure unauthenticated without exposing backend details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('INVALID_REFRESH_TOKEN', 401)));
    expect(await refreshSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('clears the session when /me fails', async () => {
    setAuthenticatedSession('access-1', user);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse('INVALID_ACCESS_TOKEN', 401)));
    await expect(getCurrentUser()).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN', status: 401 });
  });

  it('attaches the bearer token and retries one 401 after refresh', async () => {
    setAuthenticatedSession('old-token', user);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(response({ accessToken: 'new-token', tokenType: 'Bearer', expiresIn: 900, user }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await authFetch('/api/future');
    expect(result.status).toBe(200);
    expect((fetchMock.mock.calls[0][0] as Request).headers.get('authorization')).toBe('Bearer old-token');
    expect((fetchMock.mock.calls[2][0] as Request).headers.get('authorization')).toBe('Bearer new-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shares one refresh promise across concurrent 401 responses', async () => {
    setAuthenticatedSession('old-token', user);
    let resolveRefresh: ((value: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockReturnValueOnce(refreshResponse)
      .mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const first = authFetch('/api/future/one');
    const second = authFetch('/api/future/two');
    await Promise.resolve();
    resolveRefresh?.(response({ accessToken: 'shared-token', tokenType: 'Bearer', expiresIn: 900, user }));
    await Promise.all([first, second]);
    expect(fetchMock.mock.calls.filter(([input]) => input === '/api/v1/admin/auth/refresh')).toHaveLength(1);
  });

  it('does not retry a request more than once when refresh fails', async () => {
    setAuthenticatedSession('old-token', user);
    const assign = vi.spyOn(window.location, 'assign');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(errorResponse('INVALID_REFRESH_TOKEN', 401))
      .mockResolvedValueOnce(errorResponse('INVALID_REFRESH_TOKEN', 401));
    vi.stubGlobal('fetch', fetchMock);
    const result = await authFetch('/api/future');
    expect(result.status).toBe(401);
    // The guarded request itself is attempted once and never replayed. Refresh
    // gets a second attempt because a single 401 there usually means another
    // tab rotated the token first, not that the session ended.
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String((input as Request).url ?? input).endsWith('/api/future'),
      ),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(assign).toHaveBeenCalled();
  });

  it('recovers when a refresh loses the rotation race to another tab', async () => {
    // The refresh 401s because something else rotated the cookie first. The
    // browser is already holding that rotation's new token, so the retry
    // succeeds and the admin keeps working -- previously this logged them out.
    setAuthenticatedSession('old-token', user);
    const assign = vi.spyOn(window.location, 'assign');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(errorResponse('INVALID_REFRESH_TOKEN', 401))
      .mockResolvedValueOnce(
        response({ accessToken: 'rotated-by-other-tab', tokenType: 'Bearer', expiresIn: 900, user }),
      )
      .mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await authFetch('/api/future');

    expect(result.status).toBe(200);
    expect(assign).not.toHaveBeenCalled();
  });

  it('waits and makes one more attempt when the retry also loses to the same rotation', async () => {
    // Reproduces the intermittent hosted logout: the immediate retry can land
    // before the browser has applied the winning tab's Set-Cookie, so it also
    // comes back superseded. Previously this cleared a session that was never
    // actually over; the fix is a short wait before one final attempt.
    setAuthenticatedSession('old-token', user);
    const assign = vi.spyOn(window.location, 'assign');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(errorResponse('REFRESH_TOKEN_SUPERSEDED', 401))
      .mockResolvedValueOnce(errorResponse('REFRESH_TOKEN_SUPERSEDED', 401))
      .mockResolvedValueOnce(
        response({ accessToken: 'recovered-token', tokenType: 'Bearer', expiresIn: 900, user }),
      )
      .mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await authFetch('/api/future');

    expect(result.status).toBe(200);
    expect(assign).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('recovered-token');
    expect(
      fetchMock.mock.calls.filter(([input]) => input === '/api/v1/admin/auth/refresh'),
    ).toHaveLength(3);
  });

  it('gives up once the bounded superseded retries are exhausted', async () => {
    setAuthenticatedSession('old-token', user);
    const assign = vi.spyOn(window.location, 'assign');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(errorResponse('REFRESH_TOKEN_SUPERSEDED', 401))
      .mockResolvedValueOnce(errorResponse('REFRESH_TOKEN_SUPERSEDED', 401))
      .mockResolvedValueOnce(errorResponse('REFRESH_TOKEN_SUPERSEDED', 401));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/future');

    expect(assign).toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input]) => input === '/api/v1/admin/auth/refresh'),
    ).toHaveLength(3);
  });

  it('bumps the session generation on every login', async () => {
    const before = getSessionGeneration();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      response({ accessToken: 'access-3', tokenType: 'Bearer', expiresIn: 900, user }),
    ));
    await login('admin@example.com', 'password');
    expect(getSessionGeneration()).toBe(before + 1);
  });

  it('does not clear a fresh login when a pre-login speculative refresh rejects afterward', async () => {
    // Reproduces the hosted "login bounce": AuthProvider's initial mount fires
    // a refresh before any credentials exist. If login lands while that
    // refresh is still in flight, its eventual definitive rejection must not
    // wipe out the session login() just established.
    let resolveFirstAttempt: ((r: Response) => void) | undefined;
    let resolveRetryAttempt: ((r: Response) => void) | undefined;
    const firstAttempt = new Promise<Response>((resolve) => { resolveFirstAttempt = resolve; });
    const retryAttempt = new Promise<Response>((resolve) => { resolveRetryAttempt = resolve; });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstAttempt)
      .mockResolvedValueOnce(response({ accessToken: 'login-token', tokenType: 'Bearer', expiresIn: 900, user }))
      .mockReturnValueOnce(retryAttempt);
    vi.stubGlobal('fetch', fetchMock);

    const staleRefresh = refreshSession();
    await login('admin@example.com', 'password');
    expect(getAccessToken()).toBe('login-token');

    resolveFirstAttempt?.(errorResponse('INVALID_REFRESH_TOKEN', 401));
    resolveRetryAttempt?.(errorResponse('INVALID_REFRESH_TOKEN', 401));

    expect(await staleRefresh).toBeNull();
    expect(getAccessToken()).toBe('login-token');
  });

  it('keeps the session when refresh fails for a reason other than rejection', async () => {
    // A 503 or a dropped connection says nothing about the session. Ending it
    // here would sign an admin out over a momentary API hiccup.
    setAuthenticatedSession('old-token', user);
    const assign = vi.spyOn(window.location, 'assign');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(errorResponse('AUTH_SERVICE_UNAVAILABLE', 503));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/future');

    // One refresh attempt only: a 503 is not the rotation race, so retrying
    // would just hammer a struggling API.
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => input === '/api/v1/admin/auth/refresh',
      ),
    ).toHaveLength(1);
    expect(assign).not.toHaveBeenCalled();
  });
});

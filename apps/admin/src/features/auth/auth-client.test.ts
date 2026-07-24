import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authFetch,
  clearAuthenticatedSession,
  getAccessToken,
  getCurrentUser,
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
      .mockResolvedValueOnce(errorResponse('INVALID_REFRESH_TOKEN', 401));
    vi.stubGlobal('fetch', fetchMock);
    const result = await authFetch('/api/future');
    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenCalled();
  });
});

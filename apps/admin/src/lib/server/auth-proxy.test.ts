import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyAuthRoute } from './auth-proxy';

function request(path: string, init: RequestInit = {}) {
  return new NextRequest(`http://localhost:3001${path}`, init);
}

function upstream(status = 200, body: unknown = { data: { ok: true }, meta: null, error: null, requestId: 'upstream-id', timestamp: new Date().toISOString() }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'upstream-id',
      'set-cookie': 'universta_admin_refresh=rotated; HttpOnly; Path=/api/v1/admin/auth; SameSite=Lax',
    },
  });
}

describe('same-origin authentication BFF', () => {
  beforeEach(() => {
    process.env.API_BASE_URL = 'http://127.0.0.1:4000';
    process.env.ADMIN_APP_ORIGIN = 'http://localhost:3001';
    process.env.AUTH_REFRESH_COOKIE_NAME = 'universta_admin_refresh';
    vi.restoreAllMocks();
  });

  it('relays login status, safe JSON, request ID, no-store, and Set-Cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyAuthRoute(request('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'x-universta-admin-client': 'web', 'x-request-id': 'browser-1', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'secret', ignored: 'value' }),
    }), 'login');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('upstream-id');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(await response.json()).toMatchObject({ data: { ok: true }, error: null });
    expect(fetchMock.mock.calls[0][0].toString()).toBe('http://127.0.0.1:4000/api/v1/admin/auth/login');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ email: 'admin@example.com', password: 'secret' });
  });

  it('forwards only the configured refresh cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    await proxyAuthRoute(request('/api/v1/admin/auth/refresh', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001', 'x-universta-admin-client': 'web', cookie: 'universta_admin_refresh=raw.jwt; unrelated=do-not-forward' },
    }), 'refresh');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('cookie')).toBe('universta_admin_refresh=raw.jwt');
    expect(headers.get('authorization')).toBeNull();
  });

  it('forwards only bearer authorization to /me', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream());
    vi.stubGlobal('fetch', fetchMock);
    await proxyAuthRoute(request('/api/v1/admin/auth/me', {
      headers: { authorization: 'Bearer access-token', cookie: 'universta_admin_refresh=secret' },
    }), 'me');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer access-token');
    expect(headers.get('cookie')).toBeNull();
  });

  it('rejects invalid origin and missing browser client header', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const invalidOrigin = await proxyAuthRoute(request('/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'x-universta-admin-client': 'web' },
      body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
    }), 'login');
    const missingHeader = await proxyAuthRoute(request('/api/v1/admin/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://localhost:3001' },
    }), 'logout');
    expect(invalidOrigin.status).toBe(403);
    expect(missingHeader.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a safe 502 when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('http://127.0.0.1:4000 internal failure')));
    const response = await proxyAuthRoute(request('/api/v1/admin/auth/refresh', {
      method: 'POST',
      headers: { 'x-universta-admin-client': 'web' },
    }), 'refresh');
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toEqual({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Authentication service is temporarily unavailable', details: null });
    expect(JSON.stringify(body)).not.toContain('127.0.0.1');
  });

  it('normalizes unsafe upstream errors without leaking details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(500, {
      data: null,
      meta: null,
      error: { code: 'INTERNAL_ERROR', message: 'stack trace and secret', details: { password: 'secret' } },
      requestId: 'server-request',
    })));
    const response = await proxyAuthRoute(request('/api/v1/admin/auth/me', { headers: { authorization: 'Bearer token' } }), 'me');
    const body = await response.json();
    expect(body.error).toEqual({ code: 'AUTH_REQUEST_FAILED', message: 'Authentication request failed', details: null });
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

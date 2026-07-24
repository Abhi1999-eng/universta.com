import 'server-only';

import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

export type AuthProxyPath = 'login' | 'refresh' | 'logout' | 'me';

const UPSTREAM_PATHS: Record<AuthProxyPath, string> = {
  login: '/api/v1/admin/auth/login',
  refresh: '/api/v1/admin/auth/refresh',
  logout: '/api/v1/admin/auth/logout',
  me: '/api/v1/admin/auth/me',
};

const MAX_LOGIN_BODY_BYTES = 16 * 1024;
const UPSTREAM_TIMEOUT_MS = 5_000;
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_LOCKED: 'Account temporarily locked',
  INVALID_ACCESS_TOKEN: 'Invalid access token',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  VALIDATION_ERROR: 'Invalid request',
};

interface SafeEnvelope {
  data: unknown;
  meta: unknown;
  error: { code: string; message: string; details: null } | null;
  requestId: string;
  timestamp: string;
}

function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id') ?? '';
  return /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID();
}

function envelope(
  requestId: string,
  data: unknown,
  error: SafeEnvelope['error'],
  meta: unknown = null,
): SafeEnvelope {
  return {
    data,
    meta,
    error,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

function errorResponse(
  status: number,
  requestId: string,
  code: string,
  message: string,
): NextResponse<SafeEnvelope> {
  const response = NextResponse.json(
    envelope(requestId, null, { code, message, details: null }),
    { status },
  );
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}

function originIsAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  const expected = process.env.ADMIN_APP_ORIGIN ?? 'http://localhost:3001';
  return origin === expected;
}

function clientHeaderIsAllowed(request: NextRequest): boolean {
  return request.headers.get('x-universta-admin-client') === 'web';
}

function safeError(value: unknown): SafeEnvelope['error'] {
  if (!value || typeof value !== 'object') {
    return {
      code: 'AUTH_REQUEST_FAILED',
      message: 'Authentication request failed',
      details: null,
    };
  }
  const candidate = value as { code?: unknown };
  const code =
    typeof candidate.code === 'string' && SAFE_ERROR_MESSAGES[candidate.code]
      ? candidate.code
      : 'AUTH_REQUEST_FAILED';
  return {
    code,
    message: SAFE_ERROR_MESSAGES[code] ?? 'Authentication request failed',
    details: null,
  };
}

function normalizeUpstreamBody(
  value: unknown,
  requestId: string,
  status: number,
): SafeEnvelope {
  if (!value || typeof value !== 'object' || !('data' in value)) {
    return envelope(requestId, null, {
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Authentication service is temporarily unavailable',
      details: null,
    });
  }
  const candidate = value as {
    data?: unknown;
    meta?: unknown;
    error?: unknown;
    requestId?: unknown;
    timestamp?: unknown;
  };
  const upstreamRequestId =
    typeof candidate.requestId === 'string' && candidate.requestId.length <= 100
      ? candidate.requestId
      : requestId;
  if (status >= 400 || candidate.error) {
    return envelope(
      upstreamRequestId,
      null,
      safeError(candidate.error),
      null,
    );
  }
  return envelope(upstreamRequestId, candidate.data ?? null, null, candidate.meta ?? null);
}

function setCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function copyResponseHeaders(
  response: NextResponse<SafeEnvelope>,
  upstream: Response,
  requestId: string,
): void {
  response.headers.set('cache-control', 'no-store');
  response.headers.set(
    'x-request-id',
    upstream.headers.get('x-request-id') ?? requestId,
  );
  for (const cookie of setCookieHeaders(upstream.headers)) {
    response.headers.append('set-cookie', cookie);
  }
}

async function loginBody(request: NextRequest): Promise<string | NextResponse<SafeEnvelope>> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_LOGIN_BODY_BYTES) {
    return errorResponse(413, requestIdFrom(request), 'REQUEST_TOO_LARGE', 'Request is too large');
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_LOGIN_BODY_BYTES) {
    return errorResponse(413, requestIdFrom(request), 'REQUEST_TOO_LARGE', 'Request is too large');
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as { email?: unknown }).email !== 'string' ||
      typeof (parsed as { password?: unknown }).password !== 'string'
    ) {
      throw new Error('invalid body');
    }
    return JSON.stringify({
      email: (parsed as { email: string }).email,
      password: (parsed as { password: string }).password,
    });
  } catch {
    return errorResponse(400, requestIdFrom(request), 'VALIDATION_ERROR', 'Invalid request');
  }
}

export async function proxyAuthRoute(
  request: NextRequest,
  path: AuthProxyPath,
): Promise<NextResponse<SafeEnvelope>> {
  const requestId = requestIdFrom(request);
  if (!originIsAllowed(request)) {
    return errorResponse(403, requestId, 'FORBIDDEN', 'Request origin is not allowed');
  }
  if (path !== 'me' && !clientHeaderIsAllowed(request)) {
    return errorResponse(403, requestId, 'FORBIDDEN', 'Admin client header is required');
  }

  const headers = new Headers({
    accept: 'application/json',
    'x-request-id': requestId,
  });
  let body: string | undefined;
  if (path === 'login') {
    const result = await loginBody(request);
    if (typeof result !== 'string') {
      return result;
    }
    body = result;
    headers.set('content-type', 'application/json');
  } else if (path === 'refresh' || path === 'logout') {
    const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
    const cookieValue = request.cookies.get(cookieName)?.value;
    if (cookieValue) {
      headers.set('cookie', `${cookieName}=${encodeURIComponent(cookieValue)}`);
    }
  } else {
    const authorization = request.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
      headers.set('authorization', authorization);
    }
  }

  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  let upstream: Response;
  try {
    upstream = await fetch(new URL(UPSTREAM_PATHS[path], apiBaseUrl), {
      method: path === 'me' ? 'GET' : 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return errorResponse(
      502,
      requestId,
      'AUTH_SERVICE_UNAVAILABLE',
      'Authentication service is temporarily unavailable',
    );
  }

  let parsed: unknown;
  try {
    parsed = await upstream.json();
  } catch {
    return errorResponse(
      502,
      requestId,
      'AUTH_SERVICE_UNAVAILABLE',
      'Authentication service is temporarily unavailable',
    );
  }

  const responseBody = normalizeUpstreamBody(parsed, requestId, upstream.status);
  const response = NextResponse.json(responseBody, { status: upstream.status });
  copyResponseHeaders(response, upstream, responseBody.requestId);
  return response;
}

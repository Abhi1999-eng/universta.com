import {
  ApiEnvelope,
  AuthClientError,
  AuthResponseData,
  AuthenticatedAdmin,
  MeResponseData,
} from './auth.types';

const AUTH_PATHS = {
  login: '/api/v1/admin/auth/login',
  refresh: '/api/v1/admin/auth/refresh',
  logout: '/api/v1/admin/auth/logout',
  me: '/api/v1/admin/auth/me',
} as const;

let accessToken: string | null = null;
let authenticatedUser: AuthenticatedAdmin | null = null;
let refreshPromise: Promise<string | null> | null = null;
let sessionGeneration = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAuthenticatedUser(): AuthenticatedAdmin | null {
  return authenticatedUser;
}

export function setAuthenticatedSession(
  token: string,
  user: AuthenticatedAdmin,
): void {
  accessToken = token;
  authenticatedUser = user;
}

export function clearAuthenticatedSession(): void {
  sessionGeneration += 1;
  accessToken = null;
  authenticatedUser = null;
  refreshPromise = null;
}

function safeMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'ACCOUNT_LOCKED':
      return 'Sign-in is temporarily unavailable. Try again shortly.';
    case 'AUTH_SERVICE_UNAVAILABLE':
      return 'Authentication is temporarily unavailable. Try again shortly.';
    case 'INVALID_CREDENTIALS':
    case 'INVALID_ACCESS_TOKEN':
    case 'INVALID_REFRESH_TOKEN':
      return 'Unable to sign in. Check your details or try again shortly.';
    default:
      return fallback;
  }
}

function isEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'data' in value &&
      'error' in value &&
      'requestId' in value,
  );
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AuthClientError('Unable to sign in. Try again shortly.', {
      code: 'AUTH_SERVICE_UNAVAILABLE',
      status: response.status,
      requestId: response.headers.get('x-request-id'),
    });
  }

  if (!isEnvelope<T>(body)) {
    throw new AuthClientError('Unable to sign in. Try again shortly.', {
      code: 'AUTH_RESPONSE_INVALID',
      status: response.status,
      requestId: response.headers.get('x-request-id'),
    });
  }
  return body;
}

async function authRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  const envelope = await readEnvelope<T>(response);
  if (!response.ok || envelope.error || envelope.data === null) {
    const code = envelope.error?.code ?? 'AUTH_REQUEST_FAILED';
    throw new AuthClientError(
      safeMessage(code, 'Unable to sign in. Check your details or try again shortly.'),
      {
        code,
        status: response.status,
        requestId: envelope.requestId,
      },
    );
  }
  return envelope.data;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponseData> {
  const data = await authRequest<AuthResponseData>(AUTH_PATHS.login, {
    method: 'POST',
    headers: { 'x-universta-admin-client': 'web' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  setAuthenticatedSession(data.accessToken, data.user);
  return data;
}

async function performRefresh(generation: number): Promise<string | null> {
  try {
    const data = await authRequest<AuthResponseData>(AUTH_PATHS.refresh, {
      method: 'POST',
      headers: { 'x-universta-admin-client': 'web' },
    });
    if (generation !== sessionGeneration) {
      return null;
    }
    accessToken = data.accessToken;
    return data.accessToken;
  } catch {
    clearAuthenticatedSession();
    return null;
  }
}

export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh(sessionGeneration).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function getCurrentUser(
  token = accessToken,
): Promise<AuthenticatedAdmin> {
  if (!token) {
    throw new AuthClientError('Your session has expired.', {
      code: 'INVALID_ACCESS_TOKEN',
      status: 401,
    });
  }
  const data = await authRequest<MeResponseData>(AUTH_PATHS.me, {
    headers: { authorization: `Bearer ${token}` },
  });
  authenticatedUser = data.user;
  return data.user;
}

export async function logout(): Promise<void> {
  const logoutGeneration = sessionGeneration;
  try {
    await authRequest<{ loggedOut: true }>(AUTH_PATHS.logout, {
      method: 'POST',
      headers: { 'x-universta-admin-client': 'web' },
    });
  } finally {
    if (logoutGeneration === sessionGeneration) {
      clearAuthenticatedSession();
    }
  }
}

export function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const encoded = encodeURIComponent(
    returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : '/dashboard',
  );
  try {
    window.location.assign(`/login?returnTo=${encoded}`);
  } catch {
    window.history.replaceState(null, '', `/login?returnTo=${encoded}`);
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  headers.set('accept', 'application/json');
  const requestInput =
    typeof input === 'string' && input.startsWith('/') && typeof window !== 'undefined'
      ? new URL(input, window.location.origin)
      : input;
  const request = new Request(requestInput, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
  const retryRequest = request.clone();
  const response = await fetch(request);
  if (response.status !== 401) {
    return response;
  }

  const nextToken = await refreshSession();
  if (!nextToken) {
    clearAuthenticatedSession();
    redirectToLogin();
    return response;
  }

  const retryHeaders = new Headers(retryRequest.headers);
  retryHeaders.set('authorization', `Bearer ${nextToken}`);
  return fetch(
    new Request(retryRequest, {
      headers: retryHeaders,
      credentials: 'include',
      cache: 'no-store',
    }),
  );
}

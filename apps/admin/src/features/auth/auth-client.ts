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
// Bumped only by clearAuthenticatedSession. attemptRefresh's success path
// compares against a snapshot of this to detect "a logout already happened
// while this refresh was resolving" and avoid resurrecting a stale token.
let sessionGeneration = 0;
// Bumped only by a real login (setAuthenticatedSession), never by a clear.
// A caller that snapshots this before an async check can tell whether a
// login has landed since, without also tripping on the ordinary "there was
// no session" outcome, which calls clearAuthenticatedSession but must not
// count as a login having superseded anything.
let loginGeneration = 0;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getAuthenticatedUser(): AuthenticatedAdmin | null {
  return authenticatedUser;
}

export function getLoginGeneration(): number {
  return loginGeneration;
}

export function setAuthenticatedSession(
  token: string,
  user: AuthenticatedAdmin,
): void {
  loginGeneration += 1;
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

// A `fetch` with no signal can stay pending indefinitely if the connection is
// opened but never answered. That is not a theoretical concern here: the auth
// calls go through the BFF proxy to the API, and `refreshSession` shares one
// module-level promise between every caller. A single stalled refresh
// therefore wedged the whole console -- `initializeSession` never settled, so
// the status stayed 'initializing' and every admin page sat on "Checking your
// admin session…" until a hard reload, with each later refreshSession() call
// handed the same hung promise.
//
// Bounding the request means it always settles. A timeout is not a verdict on
// the session -- `performRefresh` already treats a non-rejection failure as
// "the refresh did not happen" and leaves the session standing.
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

async function authRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(AUTH_REQUEST_TIMEOUT_MS),
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

/** True for a definitive "this credential is no good" from the API, as opposed
 * to a network failure or a 5xx, which say nothing about the session. */
function isAuthRejection(error: unknown): boolean {
  return (
    error instanceof AuthClientError &&
    (error.status === 401 || error.status === 403)
  );
}

/** True only for the specific "someone else rotated this token first" code,
 * as opposed to a token that is actually invalid or expired. */
function isSupersededRejection(error: unknown): boolean {
  return error instanceof AuthClientError && error.code === 'REFRESH_TOKEN_SUPERSEDED';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The browser applies a concurrent winning rotation's Set-Cookie
// asynchronously. Under real network latency an immediate retry can read the
// cookie jar before that update lands, fail as superseded a second time, and
// (previously) log the admin out of a session that was never actually over.
// This wait is deliberately fixed and short: it only needs to outlast the gap
// between two responses that are already in flight together, not a real
// round trip.
const SUPERSEDED_RETRY_DELAY_MS = 300;

async function attemptRefresh(generation: number): Promise<string | null> {
  const data = await authRequest<AuthResponseData>(AUTH_PATHS.refresh, {
    method: 'POST',
    headers: { 'x-universta-admin-client': 'web' },
  });
  if (generation !== sessionGeneration) {
    return null;
  }
  accessToken = data.accessToken;
  return data.accessToken;
}

async function performRefresh(generation: number): Promise<string | null> {
  // Snapshotting loginGeneration here (rather than reusing sessionGeneration,
  // which clearAuthenticatedSession itself bumps) means the guard below can
  // only ever be tripped by an actual login landing mid-flight -- never by
  // this same call's own upcoming, entirely ordinary "there was no session"
  // outcome.
  const startLoginGeneration = loginGeneration;
  try {
    return await attemptRefresh(generation);
  } catch (error) {
    if (!isAuthRejection(error)) {
      // A timeout, a dropped connection or a 502 is not a verdict on the
      // session. Ending it here would log an admin out over a hiccup, so the
      // caller is told the refresh did not happen and the session stands.
      return null;
    }

    // A 401 here is usually not "your session is over" -- it is "someone else
    // rotated this token first": another tab, or a parallel request that hit
    // 401 at the same moment. Rotation is single-use by design, so the loser of
    // that race is rejected even though the session is perfectly alive, and the
    // browser is already holding the winner's new cookie. One retry uses it.
    try {
      return await attemptRefresh(generation);
    } catch (retryError) {
      if (!isAuthRejection(retryError)) {
        return null;
      }
      if (!isSupersededRejection(retryError)) {
        // Rejected twice for a reason other than a rotation race -- an
        // actually invalid or expired token. The session really is over --
        // unless a login already landed since this attempt started (e.g. a
        // pre-login speculative refresh that had no cookie to send yet), in
        // which case clearing here would wipe out a session that is
        // perfectly fresh.
        if (loginGeneration === startLoginGeneration) {
          clearAuthenticatedSession();
        }
        return null;
      }

      // Still superseded: the retry above most likely landed before the
      // browser had applied the winning rotation's Set-Cookie. Give it a
      // moment, then make one bounded final attempt before concluding the
      // session is actually gone.
      await delay(SUPERSEDED_RETRY_DELAY_MS);
      try {
        return await attemptRefresh(generation);
      } catch (finalError) {
        if (isAuthRejection(finalError) && loginGeneration === startLoginGeneration) {
          clearAuthenticatedSession();
        }
        return null;
      }
    }
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
    // performRefresh has already ended the session if the API definitively
    // rejected the credential. If it has not, the refresh merely failed to
    // happen -- a timeout, a dropped connection, a 502 -- and signing the admin
    // out over that would be exactly the overreaction this fix removes.
    if (getAuthenticatedUser() === null) {
      redirectToLogin();
    }
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

import 'server-only';

const SESSION_VALIDATION_TIMEOUT_MS = 5_000;

/** What a session check concluded.
 *
 * The third state matters. Collapsing "the API said no" and "the API did not
 * answer" into a single boolean means a timeout, a restart or a brief network
 * fault reads as an invalid session, and every admin mid-session is bounced to
 * the login screen by an outage that never touched their credentials. */
export type SessionStatus = 'valid' | 'invalid' | 'indeterminate';

/** Checks a refresh cookie against the API without rotating it.
 *
 * `invalid` is returned only when the API positively rejected the token, or
 * when there is no token to check. Anything else -- a timeout, a network error,
 * a 5xx -- is `indeterminate`, because it says nothing about the session. */
export async function checkAdminSession(
  refreshToken: string | undefined,
): Promise<SessionStatus> {
  if (!refreshToken) return 'invalid';

  const cookieName =
    process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
  const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  try {
    const response = await fetch(
      new URL('/api/v1/admin/auth/session/validate', apiBaseUrl),
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          cookie: `${cookieName}=${encodeURIComponent(refreshToken)}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(SESSION_VALIDATION_TIMEOUT_MS),
      },
    );
    if (response.ok) return 'valid';
    // 401/403 are the API's considered verdict on this token. A 500 or a 502 is
    // the API failing to have one.
    if (response.status === 401 || response.status === 403) return 'invalid';
    return 'indeterminate';
  } catch {
    return 'indeterminate';
  }
}

/** Convenience wrapper for callers that genuinely only need a boolean.
 *
 * Treats `indeterminate` as not-valid, so it must not be used to decide whether
 * to end a session. */
export async function hasValidAdminSession(
  refreshToken: string | undefined,
): Promise<boolean> {
  return (await checkAdminSession(refreshToken)) === 'valid';
}

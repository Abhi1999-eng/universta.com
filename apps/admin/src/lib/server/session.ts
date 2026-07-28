import 'server-only';

const SESSION_VALIDATION_TIMEOUT_MS = 5_000;

/** Returns false for absent, malformed, expired, revoked, or unavailable sessions. */
export async function hasValidAdminSession(
  refreshToken: string | undefined,
): Promise<boolean> {
  if (!refreshToken) return false;

  const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'universta_admin_refresh';
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
    return response.ok;
  } catch {
    return false;
  }
}

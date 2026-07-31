import { expect, test, type BrowserContext } from '@playwright/test';
import { loginAsAdmin } from './helpers/admin-auth';
import { adminBaseUrl } from './helpers/e2e-urls';

/** The login bounce, reproduced in a real browser.
 *
 * The unit and API tests prove the pieces; this proves the thing the client
 * actually experienced -- being thrown back to the sign-in screen mid-session
 * because a page navigation overlapped a token refresh. Before the fix, the
 * first test here fails by landing on /login with both auth cookies gone. */

const COOKIE = 'universta_admin_refresh';

/** Rotations go through the Admin origin's own auth proxy, which is what the
 * browser client uses. Calling the API host directly would set the rotated
 * cookie on that host instead, leaving the Admin origin holding the dead one --
 * a quirk of the test harness rather than anything a real session does. */
const REFRESH_URL = `${adminBaseUrl}/api/v1/admin/auth/refresh`;

/** What the browser client sends: the session cookie, the Origin the proxy
 * pins against, and the admin-client header it requires as a CSRF guard. */
function clientHeaders(token: string) {
  return {
    cookie: `${COOKIE}=${token}`,
    origin: adminBaseUrl,
    'x-universta-admin-client': 'web',
  };
}

async function refreshCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === COOKIE,
  );
  if (!cookie) throw new Error('signed in but no refresh cookie was set');
  return cookie;
}

test.describe.serial('refresh-token rotation does not sign the Admin out', () => {
  test('a navigation carrying the pre-rotation token is served, not bounced', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(page);
    const original = await refreshCookie(context);

    // Rotate, exactly as a background authFetch would after a 401.
    const rotation = await page.request.post(
      REFRESH_URL,
      { headers: clientHeaders(original.value) },
    );
    expect(rotation.status()).toBe(200);

    // The race, faithfully: the request was serialised before the rotation, so
    // it carries the superseded token, while the browser's jar already holds
    // the new one. Redirects are not followed, because the assertion is about
    // what the guard itself decided.
    const raced = await page.request.get(`${adminBaseUrl}/leads`, {
      headers: { cookie: `${COOKIE}=${original.value}` },
      maxRedirects: 0,
    });

    expect(
      raced.status(),
      'a navigation that merely raced a refresh must be served, not redirected to /login',
    ).toBe(200);

    // And nothing was torn down: no Set-Cookie clearing the session, and the
    // jar still holds the token the API issued.
    const setCookie = raced.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie');
    expect(
      setCookie.filter((h) => h.value.startsWith(`${COOKIE}=;`)),
      'the guard must never delete the auth cookie',
    ).toEqual([]);
    expect(
      (await context.cookies()).some((cookie) => cookie.name === COOKIE),
      'the auth cookie must still exist after a raced navigation',
    ).toBe(true);

    // The live session is unharmed and still renders.
    await page.goto('/leads');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('repeated navigations racing live rotations never reach the login screen', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(page);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await refreshCookie(context);
      // Genuinely concurrent: the rotation and the navigation are in flight at
      // the same time, so which one the server sees first varies by attempt.
      // The rotation's own status is deliberately not asserted: the app is
      // refreshing at the same time, so either side can lose the race and be
      // rejected. That is correct -- rotation is single-use. What must never
      // happen is the admin being signed out because of it.
      await Promise.all([
        page.request.post(REFRESH_URL, {
          headers: clientHeaders(current.value),
        }),
        page.goto(attempt % 2 === 0 ? '/dashboard' : '/leads'),
      ]);
      await expect(page, `attempt ${attempt + 1} was bounced to login`)
        .not.toHaveURL(/\/login/);
    }
  });

  test('every tab survives when one of them triggers the rotation', async ({
    page,
    context,
  }) => {
    await loginAsAdmin(page);
    const original = await refreshCookie(context);
    const secondTab = await context.newPage();

    await page.request.post(REFRESH_URL, { headers: clientHeaders(original.value) });

    // Both tabs had a navigation in flight when the rotation landed, so both
    // carry the superseded token. The grace is bounded but greater than one
    // precisely so a multi-tab session is not cut down to a single survivor.
    const [first, second] = await Promise.all([
      page.request.get(`${adminBaseUrl}/dashboard`, {
        headers: clientHeaders(original.value),
        maxRedirects: 0,
      }),
      page.request.get(`${adminBaseUrl}/leads`, {
        headers: clientHeaders(original.value),
        maxRedirects: 0,
      }),
    ]);
    expect([first.status(), second.status()]).toEqual([200, 200]);

    // And both tabs keep working on the current cookie.
    await Promise.all([page.goto('/dashboard'), secondTab.goto('/leads')]);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(secondTab).not.toHaveURL(/\/login/);
    await secondTab.close();
  });

  test('logout still ends the session', async ({ page, context }) => {
    // The grace must not have made sessions un-endable.
    await loginAsAdmin(page);
    const cookie = await refreshCookie(context);
    const response = await page.request.post(
      `${adminBaseUrl}/api/v1/admin/auth/logout`,
      { headers: clientHeaders(cookie.value) },
    );
    expect(response.status()).toBe(200);

    await context.addCookies([cookie]);
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 20_000 });
  });
});

export const adminBaseUrl =
  process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:3001';
export const apiBaseUrl =
  process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:4000';
export const webBaseUrl =
  process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3000';

/**
 * A public route that still wears the Admin-editable global header and footer.
 *
 * The Study Abroad route family ships its own header and footer as part of
 * the approved design, and it now covers every public listing -- `/`,
 * `/subjects`, `/courses`, `/universities`, `/scholarships` and the rest --
 * so the site chrome stands down on all of them.
 *
 * Tests about the chrome itself need a route outside that family. This was
 * `/courses`, then `/universities`, then `/scholarships`; the student login
 * is the public page that still wears the site chrome, with every header and
 * footer link the navigation tests look for.
 */
export const chromeBaseUrl = `${webBaseUrl}/student/login`;

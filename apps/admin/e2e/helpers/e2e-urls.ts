export const adminBaseUrl =
  process.env.E2E_ADMIN_BASE_URL ?? 'http://localhost:3001';
export const apiBaseUrl =
  process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:4000';
export const webBaseUrl =
  process.env.E2E_WEB_BASE_URL ?? 'http://localhost:3000';

/**
 * A public route that still wears the Admin-editable global header and footer.
 *
 * The homepage does not. The Study Abroad route family ships its own header
 * and footer as part of the approved design, and it now covers `/`,
 * `/subjects`, `/specializations` and `/courses` as well as the destination
 * guides, so the site chrome stands down on all of them.
 *
 * Tests about the chrome itself need a route outside that family. This was
 * `/courses` until the approved design reached it; `/universities` is an
 * ordinary public listing with no reason to leave.
 */
export const chromeBaseUrl = `${webBaseUrl}/universities`;

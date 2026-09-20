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
 * and footer as part of the approved design, and `/` belongs to that family
 * now that the destination listing is the homepage, so the site chrome stands
 * down there. Tests about the chrome itself ask a route outside that family;
 * `/courses` is an ordinary public listing and has no reason to leave it.
 */
export const chromeBaseUrl = `${webBaseUrl}/courses`;

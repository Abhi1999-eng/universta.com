/** The site's own public origin, for absolute URLs in metadata.
 *
 * `NEXT_PUBLIC_SITE_URL` is the documented knob, but it is baked in at build
 * time, and the deployed build is produced by CI, which does not know the
 * host's origin. `WEB_ORIGIN` is rendered into the runtime environment from
 * SSM, so it is correct on the server where sitemap, robots and metadata are
 * generated -- which is the only place this is used.
 *
 * Without the runtime fallback the deployed sitemap advertised
 * `http://localhost:3000/` for every page, telling search engines the site
 * lives on the reader's own machine. */
export const siteOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.WEB_ORIGIN ??
  'http://localhost:3000';

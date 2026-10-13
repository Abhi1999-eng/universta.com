/**
 * Where the public website lives, for the "View live" and preview links the
 * Admin draws.
 *
 * The Admin is built once in CI, which does not know the host it will run
 * on, so a build-time NEXT_PUBLIC_ value could only ever be the fallback: on
 * the demo every "View live" link opened http://localhost:3000. The origin
 * is read on the server at request time from WEB_ORIGIN (the same value the
 * deploy renders into the public site's env), written onto the document by
 * the root layout, and read back here by the client components that build
 * the links. The fallback remains the local dev site.
 */
const LOCAL_WEB_ORIGIN = 'http://localhost:3000';

export const WEB_ORIGIN_ATTRIBUTE = 'data-web-origin';

/** On the server: the origin the deploy configured, or the local site. */
export function configuredWebOrigin(): string {
  const value = process.env.WEB_ORIGIN?.trim() || process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim();
  return value ? value.replace(/\/+$/, '') : LOCAL_WEB_ORIGIN;
}

/** In the browser: what the root layout wrote onto the document. */
export function webOrigin(): string {
  if (typeof document === 'undefined') return configuredWebOrigin();
  return document.documentElement.getAttribute(WEB_ORIGIN_ATTRIBUTE) || LOCAL_WEB_ORIGIN;
}

import type { NextRequest } from 'next/server';

/**
 * Whether a browser POST to one of the site's form routes came from the site.
 *
 * The contact, university-claim and experiment routes compared the request's
 * Origin with `NEXT_PUBLIC_WEB_ORIGIN`. A `NEXT_PUBLIC_` value is fixed when
 * the app is built, and the deployed build comes from CI, which does not know
 * the host -- so the live check compared against http://localhost:3000 and
 * refused every real visitor's contact form with 403. The counselling route
 * already did this right: it accepts the origin the request arrived on and
 * `WEB_ORIGIN`, which the deploy writes into the runtime environment.
 *
 * A request without an Origin header (a same-origin GET-style form post from
 * older browsers, or a server-side caller) is allowed, as before.
 */
export function originAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return [request.nextUrl.origin, process.env.WEB_ORIGIN, process.env.NEXT_PUBLIC_WEB_ORIGIN]
    .filter(Boolean)
    .includes(origin);
}

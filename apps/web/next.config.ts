import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  // The App Router's file-system matcher does not register a route for a
  // segment that mixes literal text with a bracket in the same folder name
  // (e.g. `study-in-[countrySlug]` never appears in routes-manifest.json,
  // in this Next.js version). The actual pages live under the pure dynamic
  // segment `study-in/[countrySlug]`; these rewrites keep the public,
  // canonical URL as `/study-in-{countrySlug}` without redirecting.
  /**
   * The destination directory and country guides move to /study-abroad.
   *
   * These are the route family's own move, so they belong in routing rather
   * than in the Admin's Redirects table: that table is for one-off paths an
   * editor curates and matches an exact string, which cannot express "every
   * country slug". Editor-managed redirects continue to work exactly as before
   * through the middleware.
   *
   * Permanent, so the old address stops being indexed, and slug-preserving, so
   * every shared /countries/<slug> link lands on the same country's guide.
   */
  async redirects() {
    return [
      { source: '/countries', destination: '/study-abroad', permanent: true },
      {
        source: '/countries/:countrySlug',
        destination: '/study-abroad/:countrySlug',
        permanent: true,
      },
      /* No alias for the design's short names (uk, usa, nz). The catalogue's
         own slug is canonical and differs by environment -- the UK is `uk` in
         one and `united-kingdom` in another -- so a fixed alias would redirect
         a working page to a 404. Nothing links to the short forms yet, and an
         editor who wants one can add it in the Admin's Redirects table, which
         matches exact paths and is the right tool for a one-off. */
    ];
  },
  async rewrites() {
    return [
      { source: '/study-in-:countrySlug/cities', destination: '/study-in/:countrySlug/cities' },
      { source: '/study-in-:countrySlug/:citySlug', destination: '/study-in/:countrySlug/:citySlug' },
      { source: '/study-in-:countrySlug', destination: '/study-in/:countrySlug' },
    ];
  },
};

export default nextConfig;

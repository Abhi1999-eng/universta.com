import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // The App Router's file-system matcher does not register a route for a
  // segment that mixes literal text with a bracket in the same folder name
  // (e.g. `study-in-[countrySlug]` never appears in routes-manifest.json,
  // in this Next.js version). The actual pages live under the pure dynamic
  // segment `study-in/[countrySlug]`; these rewrites keep the public,
  // canonical URL as `/study-in-{countrySlug}` without redirecting.
  async rewrites() {
    return [
      { source: '/study-in-:countrySlug/cities', destination: '/study-in/:countrySlug/cities' },
      { source: '/study-in-:countrySlug/:citySlug', destination: '/study-in/:countrySlug/:citySlug' },
      { source: '/study-in-:countrySlug', destination: '/study-in/:countrySlug' },
    ];
  },
};

export default nextConfig;

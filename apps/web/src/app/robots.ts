import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

/* Built on each request, not at build time. The deployed build comes from
   CI, which does not know the host's origin, so a prerendered robots.txt
   pointed crawlers at http://localhost:3000/sitemap.xml. The origin is in
   the server's runtime environment (see site-origin.ts), as the sitemap
   already reads it. */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = siteOrigin;
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/compare/', '/preview'] },
    sitemap: new URL('/sitemap.xml', base).toString(),
  };
}

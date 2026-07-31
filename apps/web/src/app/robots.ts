import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';
export default function robots(): MetadataRoute.Robots { const base = siteOrigin; return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/compare/', '/preview'] }, sitemap: new URL('/sitemap.xml', base).toString() }; }

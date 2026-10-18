import { describe, expect, it, vi } from 'vitest';

describe('robots.txt', () => {
  it('is built on each request, so it names the deployed origin and not the build machine', async () => {
    const mod = await import('./robots');
    expect(mod.dynamic).toBe('force-dynamic');
  });

  it('points crawlers at the sitemap on the site’s own origin', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined);
    vi.stubEnv('WEB_ORIGIN', 'https://universta.example');
    try {
      const { default: robots } = await import('./robots');
      const result = robots();
      expect(result.sitemap).toBe('https://universta.example/sitemap.xml');
      expect(result.rules).toEqual({
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/compare/', '/preview'],
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

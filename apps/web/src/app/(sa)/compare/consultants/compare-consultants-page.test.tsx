import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/phase1', () => ({
  phaseCompare: async (_kind: string, slugs: string[]) => ({
    items: slugs.map((slug) => ({
      slug,
      name: `Consultant ${slug}`,
      verificationStatus: 'VERIFIED',
      verifiedAt: null,
      countries: [],
      services: [],
      languages: [],
      locations: [],
    })),
    invalid: [],
  }),
  phaseComparisonOptions: async () => [],
}));
vi.mock('@/lib/static-page-seo', () => ({ staticPageMetadata: async () => ({ title: 'Compare consultants | Universta' }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/compare/consultants',
  useSearchParams: () => new URLSearchParams(),
}));

import Page from './page';

describe('the consultant comparison', () => {
  it('ends with a "Next step" row asking for guidance about each consultant from its profile, and keeps "Open the profile"', async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ items: 'ashcroft,lindenhall' }) }),
    );
    expect(html).toContain('Open the profile');
    expect(html).toContain('Next step');
    for (const slug of ['ashcroft', 'lindenhall'])
      expect(html).toContain(`href="/counselling?source=general&amp;from=%2Fstudy-abroad-consultants%2F${slug}"`);
    expect(html.indexOf('Open the profile')).toBeLessThan(html.indexOf('Next step'));
  });
});

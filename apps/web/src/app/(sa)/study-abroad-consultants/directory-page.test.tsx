import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  consultants: [] as Array<Record<string, unknown>>,
  available: [] as Array<Record<string, unknown>>,
  comingSoon: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/lib/phase1', () => ({
  phaseListAll: async () => ({ data: api.consultants, meta: null, truncated: null }),
}));
vi.mock('@/lib/study-abroad', () => ({
  getDestinations: async () => ({ available: api.available, comingSoon: api.comingSoon, regions: [], counts: {} }),
}));
vi.mock('@/lib/listing-page-content', () => ({ getListingPageContent: async () => ({}) }));
vi.mock('@/lib/static-page-seo', () => ({
  staticPageMetadata: async () => ({ title: 'Study abroad consultants | Universta' }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/study-abroad-consultants',
  useSearchParams: () => new URLSearchParams(),
}));

import Page from './page';

const consultant = (slug: string, over: Record<string, unknown> = {}) => ({
  id: slug,
  name: `Consultant ${slug}`,
  slug,
  verificationStatus: 'VERIFIED',
  services: [{ name: 'Visa documentation', slug: 'visa-documentation' }],
  languages: [],
  countries: [],
  locations: [{ location: { city: 'Pune', status: 'ACTIVE' } }],
  ...over,
});

const render = async () => renderToStaticMarkup(await Page());

beforeEach(() => {
  api.consultants = [consultant('a'), consultant('b')];
  api.available = [];
  api.comingSoon = [];
});

/** One section of the page, from its id to the next section. */
const section = (html: string, id: string) => {
  const from = html.indexOf(`id="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</section>', from));
};

describe('the consultants directory', () => {
  it('closes "How to choose" with the trust box, and keeps the FAQ', async () => {
    const html = await render();
    const choose = section(html, 'choose');
    expect(choose).toContain('Check destination expertise');
    expect(choose).toContain('How Universta works with consultants');
    expect(choose.indexOf('choosegrid')).toBeLessThan(choose.indexOf('trustbox'));
    expect(section(html, 'faq')).toContain('Frequently asked questions');
  });

  it('sends "Talk to a consultant" to counselling that records the directory', async () => {
    expect(await render()).toContain(
      'href="/counselling?source=general&amp;from=%2Fstudy-abroad-consultants"',
    );
  });
});

describe('the directory\'s "near you" heading', () => {
  it('is the design\'s smaller title under a ruled eyebrow', async () => {
    const cities = section(await render(), 'cities');
    expect(cities).toContain('<p class="eyebrow">By city</p><h2 class="sec-title sec-title--sm">Study abroad consultants near you</h2>');
  });
});

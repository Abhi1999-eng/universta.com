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

describe('the directory\'s "Consultants by study destination"', () => {
  const destination = (slug: string, name: string) => ({
    name,
    slug,
    iso2Code: null,
    isPopular: false,
    isAvailable: true,
    region: null,
    summary: null,
    bands: null,
    counts: {},
  });
  const tiles = (html: string) =>
    [...section(html, 'destinations').matchAll(/<a class="destgrid__item" href="([^"]+)">.*?destgrid__name">Study in ([^<]+)<\/span><span class="destgrid__n">([^<]+)</g)].map(
      (match) => `${match[2]} ${match[3]} ${match[1]!.replace(/&amp;/g, '&')}`,
    );

  it('lists every destination with a guide: "N listed" to its consultants, "Guide" to its guide when none lists it', async () => {
    api.available = [destination('japan', 'Japan'), destination('germany', 'Germany'), destination('canada', 'Canada')];
    api.consultants = [
      consultant('a', { countries: [{ country: { name: 'Germany', slug: 'germany' } }] }),
      consultant('b', { countries: [{ country: { name: 'Germany', slug: 'germany' } }, { country: { name: 'Belize', slug: 'belize' } }] }),
    ];
    expect(tiles(await render())).toEqual([
      'Germany 2 listed /study-abroad/germany/consultants',
      /* A destination a consultant lists but no guide covers keeps its link into the list. */
      'Belize 1 listed /study-abroad-consultants?country=belize#consultants',
      'Canada Guide /study-abroad/canada',
      'Japan Guide /study-abroad/japan',
    ]);
  });

  it('still shows the destinations when no consultant lists one yet', async () => {
    api.available = [destination('japan', 'Japan')];
    expect(tiles(await render())).toEqual(['Japan Guide /study-abroad/japan']);
  });

  it('stands down when there is no destination at all', async () => {
    expect(section(await render(), 'destinations')).toBe('');
  });
});

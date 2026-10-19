import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  here: [] as Array<Record<string, unknown>>,
  everyone: [] as Array<Record<string, unknown>>,
  available: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/lib/phase1', () => ({
  phaseListAll: async (_resource: string, query?: { country?: string }) => ({
    data: query?.country ? api.here : api.everyone,
    meta: null,
    truncated: null,
  }),
}));
vi.mock('@/lib/study-abroad', () => ({
  getStudyAbroadCountry: async (slug: string) =>
    slug === 'japan' ? { country: { name: 'Japan', slug: 'japan', iso2Code: 'JP', subjects: [] } } : null,
  getDestinations: async () => ({ available: api.available, comingSoon: [], regions: [], counts: {} }),
}));
vi.mock('@/lib/country-tabs', () => ({
  loadCountryTabs: async () => [],
  destinationTotal: async () => api.here.length,
}));
vi.mock('@/components/study-abroad/PlanBand', () => ({ PlanBand: () => <section id="plan" /> }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/study-abroad/japan/consultants',
  useSearchParams: () => new URLSearchParams(),
}));

import Page from './page';

const consultant = (slug: string, countries: string[]) => ({
  id: slug,
  name: `Consultant ${slug}`,
  slug,
  verificationStatus: 'VERIFIED',
  services: [],
  languages: [],
  locations: [{ location: { city: 'Pune', status: 'ACTIVE' } }],
  countries: countries.map((name) => ({ country: { name, slug: name.toLowerCase() } })),
});
const destination = (name: string) => ({ name, slug: name.toLowerCase(), iso2Code: null, isAvailable: true, bands: null, counts: {} });

const render = async () =>
  renderToStaticMarkup(await Page({ params: Promise.resolve({ countrySlug: 'japan' }), searchParams: Promise.resolve({}) }));
const section = (html: string, id: string) => {
  const from = html.indexOf(`id="${id}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</section>', from));
};

beforeEach(() => {
  api.here = [consultant('a', ['Japan'])];
  api.everyone = [consultant('a', ['Japan']), consultant('b', ['Germany']), consultant('c', ['Germany', 'Canada'])];
  api.available = [destination('Japan'), destination('Germany'), destination('Canada'), destination('France')];
});

describe('a destination\'s consultants page', () => {
  it('adds "How to choose" with the directory\'s checks and its trust box', async () => {
    const choose = section(await render(), 'choose');
    expect(choose).toContain('How to choose a consultant for Japan');
    expect(choose).toContain('Check destination expertise');
    expect(choose).toContain('How Universta works with consultants');
    expect(choose.indexOf('choosegrid')).toBeLessThan(choose.indexOf('trustbox'));
  });

  it('links the other destinations that consultants list, A to Z, beside the trust box', async () => {
    const choose = section(await render(), 'choose');
    expect([...choose.matchAll(/<a href="([^"]+)">Consultants for ([^<]+)<\/a>/g)].map((match) => `${match[2]} ${match[1]}`)).toEqual([
      'Canada /study-abroad/canada/consultants',
      'Germany /study-abroad/germany/consultants',
    ]);
  });

  it('leaves the other destinations out when no other destination has consultants', async () => {
    api.everyone = api.here;
    const choose = section(await render(), 'choose');
    expect(choose).not.toContain('Other destinations');
    expect(choose).toContain('trustbox');
  });

  it('says plainly when nobody lists the destination yet, with counselling about it, and keeps the bands after it', async () => {
    api.here = [];
    const html = await render();
    const list = section(html, 'consultants');
    expect(list).toContain('<p class="emptyband__t">No consultant on Universta lists Japan yet.</p>');
    expect(list).toContain('href="/counselling?source=country&amp;country=japan&amp;from=%2Fstudy-abroad%2Fjapan%2Fconsultants"');
    expect(html).toContain('id="plan"');
    expect(html).toContain('id="connect"');
    expect(html).toContain('id="choose"');
  });

  it('shows no editorial "why", rules or considerations copy', async () => {
    const html = await render();
    expect(html).not.toMatch(/id="(why|regulation|considerations)"/);
  });
});

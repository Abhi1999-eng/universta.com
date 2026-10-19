import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  location: null as Record<string, unknown> | null,
  consultants: [] as Array<Record<string, unknown>>,
  destinations: [] as Array<{ name: string; slug: string; isAvailable: boolean }>,
}));
vi.mock('@/lib/phase1', () => ({
  phaseLocation: async () => {
    if (!api.location) throw new Error('not found');
    return api.location;
  },
  phaseListAll: async () => ({ data: api.consultants, meta: null, truncated: null }),
}));
vi.mock('@/lib/study-abroad', () => ({
  getDestinations: async () => ({ available: api.destinations, comingSoon: [], regions: [], counts: {} }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/study-abroad-consultants/locations/heidelberg-advisory-centre',
  useSearchParams: () => new URLSearchParams(),
}));

import Page, { generateMetadata } from './page';

const consultant = (slug: string, over: Record<string, unknown> = {}) => ({
  id: slug,
  name: `Consultant ${slug}`,
  slug,
  verificationStatus: 'VERIFIED',
  services: [],
  languages: [],
  countries: [],
  locations: [],
  ...over,
});

const heidelberg = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  name: 'Heidelberg advisory centre',
  slug: 'heidelberg-advisory-centre',
  city: 'Heidelberg',
  state: null,
  country: null,
  overview: null,
  status: 'ACTIVE',
  seo: null,
  consultants: [{ address: '1 Hauptstrasse', consultant: consultant('a') }],
  ...over,
});

const params = { params: Promise.resolve({ locationSlug: 'heidelberg-advisory-centre' }) };
const render = async () => renderToStaticMarkup(await Page(params));

beforeEach(() => {
  api.location = heidelberg();
  api.consultants = [];
  api.destinations = [];
});

describe('a consultant location page', () => {
  it('names the place in the heading and the title, and keeps the record\'s name', async () => {
    const html = await render();
    expect(html).toContain('<h1 class="hero__h1">Study abroad consultants in Heidelberg</h1>');
    expect(html).toContain('Heidelberg advisory centre');
    expect((await generateMetadata(params)).title).toEqual({
      absolute: 'Study abroad consultants in Heidelberg | Universta',
    });
  });

  it('adds the state to the place when there is one', async () => {
    api.location = heidelberg({ state: 'Baden-Württemberg' });
    expect(await render()).toContain('Study abroad consultants in Heidelberg, Baden-Württemberg</h1>');
  });

  it('falls back to the record\'s name with no city', async () => {
    api.location = heidelberg({ city: null });
    expect(await render()).toContain('Study abroad consultants in Heidelberg advisory centre</h1>');
  });

  it('crumbs Home / Consultants / Country / City', async () => {
    api.location = heidelberg({ country: { name: 'Germany', slug: 'germany' } });
    api.destinations = [{ name: 'Germany', slug: 'germany', isAvailable: true }];
    const html = await render();
    const crumbs = html.slice(html.indexOf('class="crumbs"'), html.indexOf('</nav>'));
    expect(crumbs).toContain('>Home<');
    expect(crumbs).toContain('href="/study-abroad-consultants">Consultants<');
    expect(crumbs).toContain('href="/study-abroad/germany/consultants">Germany<');
    expect(crumbs).toContain('aria-current="page">Heidelberg<');
  });

  it('keeps the existing count in the eyebrow', async () => {
    expect(await render()).toMatch(/hero__eyebrow">Heidelberg advisory centre<b>·<\/b>1 consultant</);
  });
});

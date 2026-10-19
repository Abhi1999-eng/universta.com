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

describe('the consultants directory', () => {
  it('sends "Talk to a consultant" to counselling that records the directory', async () => {
    expect(await render()).toContain(
      'href="/counselling?source=general&amp;from=%2Fstudy-abroad-consultants"',
    );
  });
});

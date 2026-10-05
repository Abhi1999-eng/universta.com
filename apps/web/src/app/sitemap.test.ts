import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Each destination's list of universities, as the sitemap announces it.
 *
 * The set used to be read off the universities list alone, which stops at
 * 2,000 rows in display order. In a catalogue of 9,761, a destination whose
 * universities all came after the two-thousandth had no list in the
 * sitemap at all.
 */

const api = vi.hoisted(() => ({
  universities: [] as Array<Record<string, unknown>>,
  /** What a destination's own university count reads, by slug. */
  totals: {} as Record<string, number | Error>,
  countReads: [] as Array<Record<string, string>>,
}));

vi.mock('@/lib/phase1', () => ({
  phaseListAll: async (resource: string) => ({
    data: resource === 'universities' ? api.universities : [],
    meta: null,
    truncated: null,
  }),
  phaseList: async (resource: string, params: Record<string, string>) => {
    if (resource !== 'universities') throw new Error(`unexpected ${resource}`);
    api.countReads.push(params);
    const total = api.totals[params.country ?? ''] ?? 0;
    if (total instanceof Error) throw total;
    return { data: total ? [{ slug: 'any' }] : [], meta: { total } };
  },
}));
vi.mock('@/lib/countries', () => ({
  getCountries: async () => ({
    data: [{ slug: 'united-kingdom' }, { slug: 'zambia' }, { slug: 'iceland' }, { slug: 'oman' }],
  }),
}));
vi.mock('@/lib/locations', () => ({
  getCountryCities: async () => ({ data: [] }),
}));
vi.mock('@/lib/catalog', () => ({
  getSubjects: async () => ({ data: [] }),
  getCourses: async () => ({ data: [] }),
}));

const { default: sitemap } = await import('./sitemap');

beforeEach(() => {
  /* Only the first two thousand come back, and all of them are British. */
  api.universities = [
    { slug: 'university-of-oxford', country: { slug: 'united-kingdom' } },
    { slug: 'imperial-college-london', country: { slug: 'united-kingdom' } },
  ];
  api.totals = {};
  api.countReads = [];
});

const lists = async () =>
  (await sitemap())
    .map((entry) => new URL(entry.url).pathname)
    .filter((path) => /^\/study-abroad\/[^/]+\/universities$/.test(path));

describe('each destination’s university list in the sitemap', () => {
  it('announces a destination whose universities the capped read never reached', async () => {
    api.totals = { zambia: 12 };
    expect(await lists()).toEqual([
      '/study-abroad/united-kingdom/universities',
      '/study-abroad/zambia/universities',
    ]);
  });

  it('asks only about the destinations the list did not already show, one row each', async () => {
    await lists();
    expect(api.countReads.map((params) => params.country)).toEqual(['zambia', 'iceland', 'oman']);
    expect(api.countReads.every((params) => params.limit === '1')).toBe(true);
  });

  it('announces no list for a destination with no university', async () => {
    expect(await lists()).toEqual(['/study-abroad/united-kingdom/universities']);
  });

  it('leaves out a destination whose count could not be read, and keeps the rest', async () => {
    api.totals = { zambia: new Error('503'), iceland: 3 };
    expect(await lists()).toEqual([
      '/study-abroad/united-kingdom/universities',
      '/study-abroad/iceland/universities',
    ]);
  });
});

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
  countries: [] as Array<{ slug: string }>,
  courses: [] as Array<{ slug: string }>,
  /** The live programmes' addresses, or the error reading them gives. */
  addresses: [] as
    | Array<{ slug: string; universitySlug: string; countrySlug: string; updatedAt: string }>
    | Error,
}));

/* A list served a page at a time, as the API serves it: `limit` rows a page
   and the page count in the meta. */
const paged = <T>(rows: T[], params: Record<string, string> = {}) => {
  const limit = Number(params.limit ?? 100);
  const page = Number(params.page ?? 1);
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
  };
};

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
  phaseProgrammeAddresses: async (params: Record<string, string>) => {
    if (api.addresses instanceof Error) throw api.addresses;
    return paged(api.addresses, params);
  },
}));
vi.mock('@/lib/countries', () => ({
  getCountries: async (params: Record<string, string>) => paged(api.countries, params),
}));
vi.mock('@/lib/locations', () => ({
  getCountryCities: async () => ({ data: [] }),
}));
vi.mock('@/lib/catalog', () => ({
  getSubjects: async () => ({ data: [] }),
  getCourses: async (params: Record<string, string>) => paged(api.courses, params),
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
  api.countries = [
    { slug: 'united-kingdom' },
    { slug: 'zambia' },
    { slug: 'iceland' },
    { slug: 'oman' },
  ];
  api.courses = [];
  api.addresses = [];
});

const paths = async () =>
  (await sitemap()).map((entry) => new URL(entry.url).pathname);

const lists = async () =>
  (await paths()).filter((path) => /^\/study-abroad\/[^/]+\/universities$/.test(path));

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

/**
 * The lists the sitemap reads a hundred at a time. It used to read only
 * the first hundred: 100 of 206 destinations, 100 of 299 course guides.
 */
describe('every destination and every course guide', () => {
  it('announces every destination, not the first hundred', async () => {
    api.countries = Array.from({ length: 206 }, (_, index) => ({ slug: `country-${index + 1}` }));
    const guides = (await paths()).filter((path) => /^\/study-abroad\/[^/]+$/.test(path));
    expect(guides).toHaveLength(206);
    expect(guides).toContain('/study-abroad/country-206');
  });

  it('announces every course guide, not the first hundred', async () => {
    api.courses = Array.from({ length: 299 }, (_, index) => ({ slug: `course-${index + 1}` }));
    const guides = (await paths()).filter((path) => /^\/courses\/[^/]+$/.test(path));
    expect(guides).toHaveLength(299);
    expect(guides).toContain('/courses/course-299');
  });
});

/**
 * The course catalogue's indexable pages -- each programme's own page and
 * each university's list of them -- were never announced.
 */
describe('programmes in the sitemap', () => {
  const warwick = {
    slug: 'university-of-warwick-msc-computer-science',
    universitySlug: 'university-of-warwick',
    countrySlug: 'united-kingdom',
    updatedAt: '2026-10-05T00:00:00.000Z',
  };

  it('announces each programme at its nested address', async () => {
    api.addresses = [warwick];
    expect(await paths()).toContain(
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science',
    );
  });

  it('announces a university’s course list only where it has a programme, and once', async () => {
    api.addresses = [
      warwick,
      { ...warwick, slug: 'university-of-warwick-bsc-computer-science' },
    ];
    const courseLists = (await paths()).filter((path) =>
      /^\/study-abroad\/[^/]+\/universities\/[^/]+\/courses$/.test(path),
    );
    /* Oxford is a published university here, but lists no programme. */
    expect(courseLists).toEqual([
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses',
    ]);
  });

  it('reads every page of addresses', async () => {
    api.addresses = Array.from({ length: 5001 }, (_, index) => ({
      ...warwick,
      slug: `programme-${index + 1}`,
    }));
    const pages = (await paths()).filter((path) => /\/courses\/programme-\d+$/.test(path));
    expect(pages).toHaveLength(5001);
  });

  it('keeps everything else when the programmes cannot be read', async () => {
    api.addresses = new Error('503');
    const all = await paths();
    expect(all).toContain('/study-abroad/united-kingdom');
    expect(all.some((path) => path.includes('/courses/university-of-warwick'))).toBe(false);
  });

  it('announces none while the catalogue has no programme', async () => {
    const all = await paths();
    expect(all.some((path) => /\/universities\/[^/]+\/courses/.test(path))).toBe(false);
  });
});

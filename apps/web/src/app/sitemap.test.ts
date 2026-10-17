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
    | Array<{
        slug: string;
        universitySlug: string;
        countrySlug: string;
        updatedAt: string;
        subjectSlug?: string | null;
        specializationSlug?: string | null;
        levelCode?: string | null;
      }>
    | Error,
  subjects: [] as Array<{ slug: string; levels?: Array<{ code: string; name: string }>; publishedSubSubjectCount?: number }>,
  /** The published specializations, or the error reading them gives. */
  specializations: [] as
    | Array<{
        slug: string;
        subject: { slug: string };
        levels: Array<{ code: string; name: string }>;
        shortDescription?: string | null;
        overview?: string | null;
      }>
    | Error,
  specializationReads: [] as Array<Record<string, string>>,
  /** The most specialization pages ever read at once. */
  inFlight: 0,
  mostInFlight: 0,
  courseLevels: [] as Array<{ code: string }> | Error,
  levelIndex: null as
    | {
        rows: Array<{
          path: string;
          subjectSlug: string;
          specializationSlug: string | null;
          levelCode: string;
          levelSlug: string;
          hasOwnContent: boolean;
          robotsIndex: boolean | null;
          updatedAt: string;
        }>;
        templateRobotsIndex: boolean | null;
      }
    | Error
    | null,
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
  getSubjects: async (params: Record<string, string>) => paged(api.subjects, params),
  getCourses: async (params: Record<string, string>) => paged(api.courses, params),
  /* Served as the API serves it: the total, and no page count. */
  getSpecializations: async (params: Record<string, string>) => {
    api.specializationReads.push(params);
    api.inFlight += 1;
    api.mostInFlight = Math.max(api.mostInFlight, api.inFlight);
    await new Promise((resolve) => setTimeout(resolve, 0));
    api.inFlight -= 1;
    if (api.specializations instanceof Error) throw api.specializations;
    const limit = Number(params.limit ?? 100);
    const page = Number(params.page ?? 1);
    return {
      data: api.specializations.slice((page - 1) * limit, page * limit),
      meta: { total: api.specializations.length, page, limit },
    };
  },
  getCourseLevels: async () => {
    if (api.courseLevels instanceof Error) throw api.courseLevels;
    return api.courseLevels;
  },
  getLevelPageIndex: async () => {
    if (api.levelIndex instanceof Error) throw api.levelIndex;
    if (!api.levelIndex) throw new Error('404');
    return api.levelIndex;
  },
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
  api.subjects = [];
  api.specializations = [];
  api.specializationReads = [];
  api.inFlight = 0;
  api.mostInFlight = 0;
  api.courseLevels = ['FOUNDATION', 'PATHWAY', 'UG', 'PG', 'MBA', 'PHD'].map((code) => ({ code }));
  /* Read, with nothing written. */
  api.levelIndex = { rows: [], templateRobotsIndex: null };
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

/**
 * The subjects family beyond each subject's own page: every subject, the
 * specializations directory, each subject's list of specializations and
 * each specialization's page where something is written on it.
 */
describe('subjects and specializations in the sitemap', () => {
  it('announces every subject, not the first hundred', async () => {
    api.subjects = Array.from({ length: 130 }, (_, index) => ({ slug: `subject-${index + 1}` }));
    const subjects = (await paths()).filter((path) => /^\/subjects\/[^/]+$/.test(path));
    expect(subjects).toHaveLength(130);
  });

  it('announces the specializations directory and each subject’s list of them where it has any', async () => {
    api.subjects = [
      { slug: 'computing', publishedSubSubjectCount: 3 },
      { slug: 'history', publishedSubSubjectCount: 0 },
    ];
    const all = await paths();
    expect(all).toContain('/specializations');
    expect(all).toContain('/subjects/computing/specializations');
    expect(all).not.toContain('/subjects/history/specializations');
  });

  it('announces a specialization’s page only where something is written on it', async () => {
    api.specializations = [
      { slug: 'ai', subject: { slug: 'computing' }, levels: [], shortDescription: 'Machines that learn.' },
      { slug: 'data', subject: { slug: 'computing' }, levels: [], overview: '<p>Data.</p>' },
      { slug: 'empty', subject: { slug: 'computing' }, levels: [], shortDescription: '  ', overview: null },
    ];
    const all = await paths();
    expect(all).toContain('/subjects/computing/ai');
    expect(all).toContain('/subjects/computing/data');
    expect(all).not.toContain('/subjects/computing/empty');
  });

  it('reads every specialization, one page after another', async () => {
    api.specializations = Array.from({ length: 150 }, (_, index) => ({
      slug: `branch-${index + 1}`,
      subject: { slug: 'computing' },
      levels: [],
      shortDescription: 'Written.',
    }));
    const pages = (await paths()).filter((path) => /^\/subjects\/computing\/branch-\d+$/.test(path));
    expect(pages).toHaveLength(150);
    expect(api.specializationReads.map((params) => params.page)).toEqual(['1', '2']);
    expect(api.specializationReads.every((params) => params.limit === '100')).toBe(true);
    expect(api.mostInFlight).toBe(1);
  });
});

/**
 * A field's page at one study level is announced where the page itself
 * would be indexed: a level the field is offered at, with three
 * programmes or more, or with enough written of its own.
 */
describe('level pages in the sitemap', () => {
  const UG = { code: 'UG', name: "Bachelor's" };
  const PG = { code: 'PG', name: "Master's" };
  const DIPLOMA = { code: 'DIPLOMA', name: 'Diploma' };
  const at = (count: number, levelCode: string, specializationSlug: string | null = null, subjectSlug = 'computing') =>
    Array.from({ length: count }, (_, index) => ({
      slug: `${subjectSlug}-${specializationSlug ?? 'none'}-${levelCode}-${index}`,
      universitySlug: 'university-of-warwick',
      countrySlug: 'united-kingdom',
      updatedAt: '2026-10-05T00:00:00.000Z',
      subjectSlug,
      specializationSlug,
      levelCode,
    }));
  const levelPaths = async () =>
    (await paths()).filter((path) => /^\/subjects\/[^/]+\/(?:[^/]+\/)?(?:foundation|pathway|bachelors|masters|mba|phd|diploma)$/.test(path));

  it('announces a subject’s level page with three programmes at it, and not with two', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG, PG] }];
    api.addresses = [...at(3, 'UG'), ...at(2, 'PG')];
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
  });

  it('counts a specialization’s level page from its own programmes only', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }];
    api.specializations = [{ slug: 'ai', subject: { slug: 'computing' }, levels: [UG] }];
    api.addresses = [...at(2, 'UG', 'ai'), ...at(1, 'UG')];
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
    api.addresses = [...at(3, 'UG', 'ai')];
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors', '/subjects/computing/ai/bachelors']);
  });

  it('never announces a level the field is not offered at, however much is listed there', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }];
    api.addresses = [...at(9, 'PG'), ...at(3, 'UG')];
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
  });

  it('announces none of the six a field offered at nothing shows', async () => {
    api.subjects = [{ slug: 'history', levels: [] }];
    api.addresses = at(9, 'FOUNDATION', null, 'history');
    expect(await levelPaths()).toEqual([]);
  });

  it('never announces a level the catalogue no longer lists', async () => {
    api.subjects = [{ slug: 'computing', levels: [DIPLOMA, UG] }];
    api.addresses = [...at(5, 'DIPLOMA'), ...at(5, 'UG')];
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
    api.courseLevels = new Error('503');
    expect(await levelPaths()).toEqual([]);
  });

  it('announces no level page from addresses that do not say where they belong', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }];
    api.addresses = at(5, 'UG').map((row) => ({
      slug: row.slug,
      universitySlug: row.universitySlug,
      countrySlug: row.countrySlug,
      updatedAt: row.updatedAt,
    }));
    expect(await levelPaths()).toEqual([]);
    /* The programmes themselves are still announced. */
    expect((await paths()).filter((path) => path.includes('/courses/computing-'))).toHaveLength(5);
  });

  it('keeps everything else when the specializations cannot be read', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }];
    api.specializations = new Error('503');
    api.addresses = [...at(3, 'UG'), ...at(3, 'UG', 'ai')];
    const all = await paths();
    expect(all).toContain('/study-abroad/united-kingdom');
    expect(all).toContain('/subjects/computing');
    expect(all).toContain('/subjects/computing/bachelors');
    expect(all).not.toContain('/subjects/computing/ai/bachelors');
    expect(all.some((path) => path.includes('/courses/computing-none-UG-0'))).toBe(true);
  });

  it('announces a written page with nothing listed, when it last changed', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG, PG] }];
    api.levelIndex = {
      rows: [{
        path: '/subjects/computing/masters', subjectSlug: 'computing', specializationSlug: null,
        levelCode: 'PG', levelSlug: 'masters', hasOwnContent: true, robotsIndex: true,
        updatedAt: '2026-10-16T10:00:00.000Z',
      }],
      templateRobotsIndex: null,
    };
    const entries = await sitemap();
    const masters = entries.find((entry) => new URL(entry.url).pathname === '/subjects/computing/masters');
    expect(masters?.lastModified).toBe('2026-10-16T10:00:00.000Z');
    expect(await levelPaths()).toEqual(['/subjects/computing/masters']);
  });

  it('leaves out a page whose robots setting says no, whatever is listed at it', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG, PG] }];
    api.addresses = [...at(5, 'UG'), ...at(5, 'PG')];
    api.levelIndex = {
      rows: [{
        path: '/subjects/computing/bachelors', subjectSlug: 'computing', specializationSlug: null,
        levelCode: 'UG', levelSlug: 'bachelors', hasOwnContent: true, robotsIndex: false,
        updatedAt: '2026-10-16T10:00:00.000Z',
      }],
      templateRobotsIndex: null,
    };
    expect(await levelPaths()).toEqual(['/subjects/computing/masters']);
    /* The Level pages template's no keeps out the pages nobody wrote, and
       not a written one that says yes. */
    api.levelIndex = {
      rows: [{
        path: '/subjects/computing/bachelors', subjectSlug: 'computing', specializationSlug: null,
        levelCode: 'UG', levelSlug: 'bachelors', hasOwnContent: true, robotsIndex: true,
        updatedAt: '2026-10-16T10:00:00.000Z',
      }],
      templateRobotsIndex: false,
    };
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
  });

  /* The written pages carry the robots settings: a page whose own says
     noindex must not go out on its programmes alone. */
  it('announces no level page while the written pages cannot be read', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }];
    api.addresses = at(5, 'UG');
    expect(await levelPaths()).toEqual(['/subjects/computing/bachelors']);
    api.levelIndex = new Error('503');
    const all = await paths();
    expect(all.filter((path) => path.startsWith('/subjects/computing/'))).toEqual([]);
    /* Only the level pages: the subject and its programmes still go out. */
    expect(all).toContain('/subjects/computing');
    expect(all.filter((path) => path.includes('/courses/computing-none-UG-'))).toHaveLength(5);
  });

  it('announces each level page once', async () => {
    api.subjects = [{ slug: 'computing', levels: [UG] }, { slug: 'computing', levels: [UG] }];
    api.addresses = at(3, 'UG');
    api.levelIndex = {
      rows: [{
        path: '/subjects/computing/bachelors', subjectSlug: 'computing', specializationSlug: null,
        levelCode: 'UG', levelSlug: 'bachelors', hasOwnContent: true, robotsIndex: true,
        updatedAt: '2026-10-16T10:00:00.000Z',
      }],
      templateRobotsIndex: null,
    };
    const all = await paths();
    expect(all.filter((path) => path === '/subjects/computing/bachelors')).toHaveLength(1);
    expect(all.filter((path) => path === '/subjects/computing')).toHaveLength(1);
  });
});

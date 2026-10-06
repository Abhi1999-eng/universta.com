import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The pages are rendered whole, with every read answered from here. The
   bands that reach for the shell's dialogs, and the guide links that need
   a full country record, are not what these assertions are about. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openSelector: vi.fn() }),
}));
vi.mock('@/lib/study-abroad-view', () => ({ guideLinks: () => [] }));
vi.mock('@/lib/country-tabs', () => ({
  loadCountryTabs: async () => [],
  tabCounts: () => ({ universities: 0, scholarships: 0 }),
}));
vi.mock('@/lib/country-subject-related', () => ({
  specializationUniversities: async () => ({
    total: 4,
    group: { title: 'Universities', items: [] },
  }),
  scholarshipsGroup: async () => ({ title: 'Scholarships', items: [] }),
  consultantsGroup: async () => ({ title: 'Consultants', items: [] }),
}));

const uk = {
  id: 'gb',
  name: 'United Kingdom',
  slug: 'united-kingdom',
  iso2Code: 'GB',
  subjects: [],
};
vi.mock('@/lib/study-abroad', () => ({
  getStudyAbroadCountry: async () => ({ country: uk, consultants: null }),
}));

const level = { id: 'u', code: 'UG', name: "Bachelor's", educationOrder: 3 };
vi.mock('@/lib/university-related', () => ({
  subjectUniversitiesGroup: async () => ({ title: 'Universities', items: [], total: 11 }),
  subjectUniversitiesHref: (country: string, subject: string) =>
    `/study-abroad/${country}/universities?subjects=${subject}`,
}));
/* The course guides' own figures for the pair, which the strip and the
   chips used before any programme was listed: Software Engineering 2 and
   Machine Learning 1, opening in July, August and September. */
const guides = vi.hoisted(() => ({
  subSubjects: [] as Array<{ id: string; name: string; slug: string }>,
  filters: { intakes: [] as unknown[], subSubjects: [] as unknown[] },
}));
const branch = (name: string, slug: string) => ({ id: slug, name, slug });
const guideOption = (slug: string, count: number) => ({
  value: slug,
  label: slug,
  count,
  subject: { slug: 'computer-science' },
});
const guideIntake = (label: string, startMonth: number) => ({ value: label, label, startMonth, count: 1 });
vi.mock('@/lib/catalog', () => ({
  getSubject: async () => ({
    id: 'cs',
    name: 'Computer Science',
    slug: 'computer-science',
    shortDescription: null,
    overview: null,
    iconMedia: null,
    subSubjects: guides.subSubjects,
  }),
  getSpecialization: async () => ({
    id: 'se',
    name: 'Software Engineering',
    slug: 'software-engineering',
    shortDescription: null,
    overview: null,
    iconMedia: null,
    subject: { id: 'cs', name: 'Computer Science', slug: 'computer-science' },
    siblings: [],
    siblingTotal: 0,
  }),
  getCoursesByLevel: async () => [
    {
      level,
      count: 2,
      courses: [
        {
          id: 'c1',
          name: 'BSc Computer Science',
          slug: 'bsc-computer-science',
          subSubject: null,
          duration: { min: '3', max: '3', unit: 'YEARS' },
          studyModes: [],
          selectedTuition: null,
          availableCountryCount: 1,
          courseLevel: level,
        },
      ],
    },
  ],
  getCourseFilterOptions: async () => guides.filters,
  getCourseLevels: async () => [level],
  getCourses: async () => ({ data: [], meta: { total: 0 } }),
}));

const api = vi.hoisted(() => ({
  reads: [] as Array<Record<string, string>>,
  programmes: 4,
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: async (params: Record<string, string>) => {
    api.reads.push(params);
    const total = api.programmes;
    return {
      data: total
        ? [
            {
              id: 'w',
              slug: 'university-of-warwick-bsc-computer-science',
              name: 'BSc Computer Science',
              genericCourse: { name: 'BSc Computer Science', slug: 'bsc-computer-science' },
              university: {
                name: 'University of Warwick',
                slug: 'university-of-warwick',
                country: uk,
                campuses: [{ city: 'Coventry' }],
              },
            },
          ]
        : [],
      meta: { page: 1, limit: 18, total, totalPages: total ? 1 : 0, sort: 'relevance', ignored: [] },
      facets: {
        countries: [{ value: 'united-kingdom', label: 'United Kingdom', count: total }],
        subjects: [{ value: 'computer-science', label: 'Computer Science', count: total }],
        specializations: [
          { value: 'software-engineering', label: 'Software Engineering', count: total },
          { value: 'artificial-intelligence', label: 'Artificial Intelligence', count: 1 },
        ],
        universities: [
          { value: 'university-of-warwick', label: 'University of Warwick', count: 1 },
          { value: 'university-of-manchester', label: 'University of Manchester', count: 1 },
        ],
        cities: [
          { value: 'coventry', label: 'Coventry', count: 1 },
          { value: 'manchester', label: 'Manchester', count: 1 },
        ],
        intakes: total
          ? [{ value: 'september', label: 'September', startMonth: 9, endMonth: 9, shortLabel: 'Sep', count: 2 }]
          : [],
      },
      summary: { programmes: total, universities: total, cities: total ? 3 : 0, intakeMonths: 1, countries: 1 },
    };
  },
}));

const SpecializationPage = (
  await import('@/app/(sa)/study-abroad/[countrySlug]/[subjectSlug]/[specializationSlug]/page')
);
const SubjectPage = await import('@/app/(sa)/study-abroad/[countrySlug]/[subjectSlug]/page');

const params = Promise.resolve({
  countrySlug: 'united-kingdom',
  subjectSlug: 'computer-science',
  specializationSlug: 'software-engineering',
});
const render = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await SpecializationPage.default({ params, searchParams: Promise.resolve(query) }),
  );

beforeEach(() => {
  api.reads = [];
  api.programmes = 4;
  guides.subSubjects = [];
  guides.filters = { intakes: [], subSubjects: [] };
});

/**
 * The design's course listing on a field's page in one destination: the
 * search, the filter panel, the sort and the programme cards, fixed to the
 * country and the field, with the catalogue's level groups kept below.
 */
describe('a specialization in one destination', () => {
  it('lists its programmes in the design’s results block', async () => {
    const html = await render();
    expect(html).toContain('id="courses"');
    expect(html).toContain('Software Engineering programmes in the United Kingdom');
    expect(html).toContain('class="cresults"');
    expect(html).toContain('class="coursecard"');
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-bsc-computer-science"',
    );
  });

  it('fixes the list to the country and the field, and counts over that part alone', async () => {
    await render();
    expect(api.reads[0]).toMatchObject({
      country: 'united-kingdom',
      subject: 'computer-science',
      specialization: 'software-engineering',
      within: 'country,subject,specialization',
    });
  });

  it('never offers the country or the field in the rail, which the address already names', async () => {
    const html = await render();
    expect(html).not.toMatch(/<p class="fgroup__t"[^>]*>Country</);
    expect(html).not.toMatch(/<p class="fgroup__t"[^>]*>Subject</);
    expect(html).not.toMatch(/<p class="fgroup__t"[^>]*>Specialization</);
    expect(html).toMatch(/<p class="fgroup__t"[^>]*>University</);
    expect(html).toMatch(/<p class="fgroup__t"[^>]*>City</);
  });

  it('keeps its level groups, whose links open the course guides they count', async () => {
    const html = await render();
    expect(html).toContain('id="programs"');
    expect(html).toContain('id="level-ug"');
    expect(html).toContain(
      'href="/courses?country=united-kingdom&amp;subject=computer-science&amp;specialization=software-engineering&amp;view=guides"',
    );
  });

  it('counts the programmes, universities and cities in its strip, as the design does', async () => {
    const html = await render();
    const strip = /<div class="statstrip[^"]*">.*?<\/div><\/div>/.exec(html)?.[0] ?? '';
    expect(strip).toMatch(/<b class="datum">4<\/b><span>Programmes<\/span>/);
    expect(strip).toMatch(/<b class="datum">3<\/b><span>Cities<\/span>/);
  });

  it('opens the finder on the same three, under the finder’s own names', async () => {
    const html = await render();
    const here =
      'href="/courses?country=united-kingdom&amp;subject=computer-science&amp;specialization=software-engineering#discovery"';
    expect(html).toContain(`${here}>Open in search`);
    expect(html).toContain(`${here}>Browse these courses`);
    expect(html).not.toContain('subSubject=');
  });

  it('reads as it did where no programme is listed', async () => {
    api.programmes = 0;
    const html = await render();
    expect(html).not.toContain('id="courses"');
    expect(html).not.toContain('class="cresults"');
    expect(html).toContain('id="level-ug"');
    expect(html).not.toMatch(/<span>Cities<\/span>/);
  });
});

describe('a subject in one destination', () => {
  const subjectParams = Promise.resolve({
    countrySlug: 'united-kingdom',
    subjectSlug: 'computer-science',
  });
  const renderSubject = async (query: Record<string, string> = {}) =>
    renderToStaticMarkup(
      await SubjectPage.default({
        params: subjectParams,
        searchParams: Promise.resolve(query),
      }),
    );

  it('lists its programmes, fixed to the country and the subject', async () => {
    const html = await renderSubject();
    expect(html).toContain('Computer Science programmes in the United Kingdom');
    expect(html).toContain('class="coursecard"');
    expect(api.reads[0]).toMatchObject({
      country: 'united-kingdom',
      subject: 'computer-science',
      within: 'country,subject',
    });
    /* A specialization is a filter here, not part of what the page is. */
    expect(html).toMatch(/<p class="fgroup__t"[^>]*>Specialization</);
    expect(html).not.toMatch(/<p class="fgroup__t"[^>]*>Subject</);
  });

  it('keeps its levels, and counts cities in its strip', async () => {
    const html = await renderSubject();
    expect(html).toContain('id="level-ug"');
    expect(html).toContain(
      'href="/courses?country=united-kingdom&amp;subject=computer-science&amp;level=UG&amp;view=guides"',
    );
    expect(html).toMatch(/<b class="datum">3<\/b><span>Cities<\/span>/);
  });

  it('keeps a narrowed list out of the index', async () => {
    const meta = await SubjectPage.generateMetadata({
      params: subjectParams,
      searchParams: Promise.resolve({ level: 'UG' }),
    });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  /* The strip and the chips sit straight above the programme list, so they
     count what it counts. They counted the course guides: "Software
     Engineering 2" over a list offering Software Engineering 4, and the
     chip opened a page saying 4 Programmes. */
  describe('its hero, over the programme list', () => {
    const strip = (html: string) =>
      [...(/<div class="statstrip[^"]*">(.*?)<\/div><\/div>/.exec(html)?.[1] ?? '').matchAll(
        /<b[^>]*>([^<]+)<\/b><span>([^<]+)<\/span>/g,
      )].map((cell) => `${cell[1]} ${cell[2]}`);
    const chips = (html: string) =>
      [...html.matchAll(/<a class="specchip specchip--live" href="([^"]+)">([^<]+)<em>(\d+)<\/em><\/a>/g)].map(
        (chip) => `${chip[2]} ${chip[3]} ${chip[1]}`,
      );

    beforeEach(() => {
      guides.subSubjects = [
        branch('Software Engineering', 'software-engineering'),
        branch('Artificial Intelligence', 'artificial-intelligence'),
        branch('Machine Learning', 'machine-learning'),
      ];
      guides.filters = {
        intakes: [guideIntake('Jul', 7), guideIntake('Aug', 8), guideIntake('Sep', 9)],
        subSubjects: [guideOption('software-engineering', 2), guideOption('machine-learning', 1)],
      };
    });

    it('counts its specializations, their chips and its intakes from the programmes', async () => {
      const html = await renderSubject();
      expect(strip(html)).toEqual([
        '4 Programmes',
        '4 Universities',
        '3 Cities',
        '2 Specializations taught',
        'Sep Intakes',
      ]);
      expect(chips(html)).toEqual([
        'Software Engineering 4 /study-abroad/united-kingdom/computer-science/software-engineering',
        'Artificial Intelligence 1 /study-abroad/united-kingdom/computer-science/artificial-intelligence',
      ]);
    });

    it('keeps the course guides’ counts on the specialization cards, which say they count courses', async () => {
      const html = await renderSubject();
      const section = html.slice(html.indexOf('id="specializations"'), html.indexOf('id="courses"'));
      expect(section).toContain('2 courses');
      expect(section).toContain('1 course');
    });

    it('counts the course guides, as it always did, where no programme is listed', async () => {
      api.programmes = 0;
      const html = await renderSubject();
      expect(strip(html)).toEqual([
        '2 Programmes',
        '11 Universities',
        '2 Specializations taught',
        'Jul, Aug, Sep Intakes',
      ]);
      expect(chips(html)).toEqual([
        'Software Engineering 2 /study-abroad/united-kingdom/computer-science/software-engineering',
        'Machine Learning 1 /study-abroad/united-kingdom/computer-science/machine-learning',
      ]);
    });
  });
});

describe('a specialization in one destination, its intakes', () => {
  it('takes them from the programmes listed', async () => {
    guides.filters = { intakes: [guideIntake('Jul', 7), guideIntake('Sep', 9)], subSubjects: [] };
    expect(await render()).toMatch(/<b>Sep<\/b><span>Intakes<\/span>/);
    api.programmes = 0;
    expect(await render()).toMatch(/<b>Jul, Sep<\/b><span>Intakes<\/span>/);
  });
});

describe('what a search engine is told', () => {
  const metadata = (query: Record<string, string>) =>
    SpecializationPage.generateMetadata({ params, searchParams: Promise.resolve(query) });

  it('indexes the page whole, under its own address', async () => {
    const meta = await metadata({});
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe(
      '/study-abroad/united-kingdom/computer-science/software-engineering',
    );
  });

  it('keeps a filtered, searched or sorted list out of the index, its links followed', async () => {
    const narrowed: Array<Record<string, string>> = [
      { university: 'university-of-warwick' },
      { q: 'data' },
      { sort: 'name' },
      { page: '2' },
    ];
    for (const query of narrowed) {
      const meta = await metadata(query);
      expect(meta.robots).toEqual({ index: false, follow: true });
      expect(meta.alternates).toBeUndefined();
    }
  });

  it('treats a campaign tag as the page itself', async () => {
    expect((await metadata({ utm_source: 'newsletter' })).robots).toBeUndefined();
  });
});

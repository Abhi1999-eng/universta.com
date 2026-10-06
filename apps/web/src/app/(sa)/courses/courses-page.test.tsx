// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The page is rendered whole against stubbed lists. The course guides'
   API is stubbed the way the real one behaves: a value it does not know
   is a 400. A redirect is an error here, because the page must never send
   a reader away from /courses any more. */
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  permanentRedirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/courses',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));
vi.mock('@/lib/static-page-seo', () => ({
  staticPageMetadata: async () => ({
    title: 'Courses | Universta',
    description: 'Search published courses.',
    alternates: { canonical: '/courses' },
    robots: { index: true, follow: true },
  }),
}));
vi.mock('@/lib/listing-page-content', () => ({
  getListingPageContent: async () => ({}),
}));

/* `taught` is the course guides some live programme teaches. */
const state = { programmes: 3, guidesDown: false, taught: [] as string[] };
const sentToGuides: Array<Record<string, string>> = [];

const options = {
  levels: [{ value: 'PG', label: "Master's", count: 100 }],
  countries: [{ value: 'denmark', label: 'Denmark', count: 15, currencyCode: 'DKK' }],
  subjects: [{ value: 'computer-science', label: 'Computer Science', count: 36 }],
  subSubjects: [
    {
      value: 'software-engineering',
      label: 'Software Engineering',
      count: 5,
      subject: { slug: 'computer-science', name: 'Computer Science' },
    },
  ],
  studyModes: [{ value: 'FULL_TIME', label: 'Full time', count: 188 }],
  intakes: [{ value: 'september', label: 'Sep', count: 162, startMonth: 9, endMonth: 9 }],
  englishTests: [],
  extras: [],
  sorts: [{ value: 'featured', label: 'Recommended' }],
  tuition: { enabled: false, country: null, currencyCode: null },
};

/* What the guides' API refuses, as it refuses it. */
function refuse(params: Record<string, string>) {
  const known = {
    country: ['denmark'],
    subject: ['computer-science'],
    subSubject: ['software-engineering'],
    level: ['PG'],
    studyMode: ['FULL_TIME'],
    intake: ['september'],
  } as Record<string, string[]>;
  for (const [key, allowed] of Object.entries(known))
    for (const value of params[key]?.split(',') ?? [])
      if (!allowed.includes(value)) throw new Error('COURSE_FILTER_OPTION_INVALID');
  if (params.sort && !['featured', 'name', 'newest', 'tuition-low', 'popularity'].includes(params.sort))
    throw new Error('VALIDATION_ERROR');
  if (Number(params.pageSize) > 100) throw new Error('VALIDATION_ERROR');
  if (params.sort === 'tuition-low' && params.country?.split(',').length !== 1)
    throw new Error('COURSE_TUITION_COUNTRY_REQUIRED');
}

vi.mock('@/lib/catalog', () => ({
  getCourses: async (params: Record<string, string> = {}) => {
    if (state.guidesDown) throw new Error('down');
    refuse(params);
    sentToGuides.push(params);
    return {
      data: [
        {
          id: 'c1',
          name: 'MSc Software Engineering',
          slug: 'msc-software-engineering',
          shortName: null,
          qualificationName: null,
          shortDescription: null,
          subject: { id: 's', name: 'Computer Science', slug: 'computer-science' },
          subSubject: null,
          courseLevel: { id: 'l', name: "Master's", code: 'PG' },
          studyModes: [],
          duration: { min: null, max: null, unit: null },
          credits: null,
          featuredMedia: null,
          featured: false,
          availableCountryCount: 2,
          selectedCountry: null,
          selectedTuition: null,
          selectedIntakes: [],
          scholarshipAvailable: null,
          displayOrder: 0,
        },
      ],
      meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    };
  },
  getCourseFilterOptions: async (params: Record<string, string> = {}) => {
    if (state.guidesDown) throw new Error('down');
    refuse(params);
    return options;
  },
  getSubjects: async () => ({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
  getCourse: async (slug: string) => {
    if (slug !== 'ba-law-15') throw new Error('COURSE_NOT_FOUND');
    return { name: 'BA Law', slug };
  },
}));

vi.mock('@/lib/phase1', () => ({
  phaseList: async () => ({ data: [] }),
  phaseProgrammes: async (params: Record<string, string>) => ({
    data: Array.from({ length: Math.min(state.programmes, Number(params.limit)) }, (_, index) => ({
      id: `o${index}`,
      name: `MSc Course ${index}`,
      slug: `university-of-warwick-msc-course-${index}`,
      university: {
        name: 'University of Warwick',
        slug: 'university-of-warwick',
        country: { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' },
      },
    })),
    meta: {
      page: 1,
      limit: Number(params.limit),
      total: state.programmes,
      totalPages: 1,
      sort: 'relevance',
      ignored: params.level === 'nope' ? ['level=nope'] : [],
    },
    summary: { programmes: state.programmes, universities: 1, cities: 1, intakeMonths: 1, countries: 1 },
    /* As the API names chosen courses: only those a live programme
       teaches, each with its count. */
    facets: {
      courses: (params.course?.split(',') ?? [])
        .filter((slug) => state.taught.includes(slug))
        .map((slug) => ({ value: slug, label: slug, count: 2 })),
    },
  }),
}));

import { renderToStaticMarkup } from 'react-dom/server';
import CoursesPage, { generateMetadata } from './page';

const page = async (raw: Record<string, string>) =>
  renderToStaticMarkup(await CoursesPage({ searchParams: Promise.resolve(raw) }));

beforeEach(() => {
  state.programmes = 3;
  state.guidesDown = false;
  state.taught = [];
  sentToGuides.length = 0;
});

describe('/courses', () => {
  it('is indexed bare under its canonical, and every narrower state is not', async () => {
    const bare = await generateMetadata({ searchParams: Promise.resolve({}) });
    expect(bare.robots).toEqual({ index: true, follow: true });
    expect(bare.alternates).toEqual({ canonical: '/courses' });
    expect(bare.title).toBe('Courses');
    for (const raw of [{ country: 'denmark' }, { q: 'x' }, { page: '2' }, { view: 'guides' }]) {
      const narrowed = await generateMetadata({ searchParams: Promise.resolve(raw) });
      expect(narrowed.robots).toEqual({ index: false, follow: true });
      expect(narrowed.alternates).toBeUndefined();
    }
  });

  it('answers a subject, specialization and country here instead of redirecting', async () => {
    const html = await page({
      country: 'united-kingdom',
      subject: 'computer-science',
      subSubject: 'software-engineering',
      q: 'warwick',
    });
    expect(html).toContain('data-testid="course-grid"');
    expect(html).toContain('value="warwick"');
  });

  it('renders the page for every value it cannot use, in both views', async () => {
    const unusable: Array<Record<string, string>> = [
      { sort: 'fee' },
      { level: 'masters' },
      { level: 'nope' },
      { studyMode: 'full-time' },
      { country: 'atlantis' },
      { subject: 'nope' },
      { intake: 'smarch' },
      { pageSize: '500' },
      { sort: 'tuition-low' },
    ];
    for (const raw of unusable) {
      for (const view of [{}, { view: 'guides' }] as Array<Record<string, string>>) {
        const html = await page({ ...raw, ...view });
        expect(html, JSON.stringify(raw)).not.toContain('temporarily unavailable');
        expect(html).toContain('id="discovery"');
      }
    }
  });

  it('never chips a value the programmes API said it ignored', async () => {
    const html = await page({ level: 'nope' });
    expect(html).not.toContain('nope');
  });

  it('opens on the course guides, with no switcher, when there is no programme', async () => {
    state.programmes = 0;
    const html = await page({});
    expect(html).toContain('data-testid="course-guide-grid"');
    expect(html).not.toContain('cf-switch');
  });

  it('opens on programmes, and on the guides when asked', async () => {
    expect(await page({})).toContain('data-testid="course-grid"');
    expect(await page({ view: 'guides' })).toContain('data-testid="course-guide-grid"');
  });

  it('keeps "temporarily unavailable" for an outage of the course guides', async () => {
    state.programmes = 0;
    state.guidesDown = true;
    expect(await page({})).toContain('Courses are temporarily unavailable');
  });

  it('links a guide to its programmes only when a live programme teaches it', async () => {
    expect(await page({ view: 'guides' })).not.toContain('Compare programmes');
    state.taught = ['msc-software-engineering'];
    const html = await page({ view: 'guides' });
    expect(html).toContain('href="/courses?course=msc-software-engineering#discovery"');
    /* With no programme in the catalogue there is nothing to ask. */
    state.programmes = 0;
    expect(await page({})).not.toContain('Compare programmes');
  });

  it('names a chosen course no programme teaches from its own guide', async () => {
    const html = await page({ course: 'ba-law-15' });
    expect(html).toContain('aria-label="Remove BA Law"');
    /* A slug that is no guide stays as it was written. */
    expect(await page({ course: 'no-such-course' })).toContain('aria-label="Remove no-such-course"');
  });

  it('still lists programmes when only the course guides are down', async () => {
    state.guidesDown = true;
    const html = await page({});
    expect(html).toContain('data-testid="course-grid"');
    expect(html).not.toContain('temporarily unavailable');
  });
});

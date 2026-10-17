import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseGuidesResultsProps } from '@/components/reference/CourseGuidesResults';
import type { SubjectLevelPageData } from '@/lib/catalog';
import { siteOrigin } from '@/lib/site-origin';
import type { ProgrammeResultsProps } from './ProgrammeResults';

type Level = { id: string; code: string; name: string; description: string | null; educationOrder: number };

const state = vi.hoisted(() => ({
  empty: false,
  optionsMissing: false,
  programmesMissing: false,
  /** How many programmes the level lists. */
  total: 9,
  /** The Bachelor's level's own description (Admin, Course levels). */
  ugDescription: null as string | null,
  /** A subject offered at nothing: no ticks, no branches, no courses. */
  bare: false,
  subjectRobots: true as boolean | undefined,
  specializationRobots: undefined as boolean | undefined,
  /** The specialization's levels: its ticks with its courses' levels. */
  specializationLevels: null as Array<{ id: string; code: string; name: string }> | null,
  /** What the API holds for the page an editor writes, or null for none. */
  levelPage: null as unknown,
}));
const renders = vi.hoisted(() => ({ programmes: vi.fn(), guides: vi.fn() }));
/* React's `cache` does not memoize outside a server render, and the page
   shares its reads between its metadata and itself through it: one memo
   per wrapped function, emptied before each test. */
const memo = vi.hoisted(() => ({ maps: [] as Array<Map<string, unknown>> }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <A extends unknown[], R>(run: (...args: A) => R) => {
      const map = new Map<string, R>();
      memo.maps.push(map as Map<string, unknown>);
      return (...args: A) => {
        const key = JSON.stringify(args);
        if (!map.has(key)) map.set(key, run(...args));
        return map.get(key)!;
      };
    },
  };
});

const levels: Level[] = [
  { code: 'FOUNDATION', name: 'Foundation' },
  { code: 'PATHWAY', name: 'Pathway' },
  { code: 'UG', name: "Bachelor's" },
  { code: 'PG', name: "Master's" },
  { code: 'MBA', name: 'MBA' },
  { code: 'PHD', name: 'PhD' },
].map((level, index) => ({ ...level, id: level.code.toLowerCase(), description: null, educationOrder: index + 1 }));
const [, , UG, PG, MBA] = levels;
const ref = (level: Level) => ({ id: level.id, code: level.code, name: level.name });
/* Ticked for Bachelor's and MBA; its branches add Master's. */
const subject = {
  id: 'computing', slug: 'computing', name: 'Computing',
  offeredLevels: [ref(UG), ref(MBA)],
  subSubjects: [
    { id: 'cs', slug: 'computer-science', name: 'Computer Science', levels: [ref(UG), ref(PG)] },
    { id: 'ds', slug: 'data-science', name: 'Data Science', levels: [ref(UG), ref(PG)] },
    { id: 'lt', slug: 'law-tech', name: 'Law Tech', levels: [ref(PG)] },
  ],
  courseCountsByLevel: [{ level: ref(UG), count: 2 }],
};
const subjectNow = () => ({
  ...subject,
  seo: state.subjectRobots === undefined ? null : { robotsIndex: state.subjectRobots },
  ...(state.bare ? { offeredLevels: [], subSubjects: [], courseCountsByLevel: [] } : {}),
});
const specializationNow = () => ({
  id: 'cs', slug: 'computer-science', name: 'Computer Science', subject,
  offeredLevels: [], levels: state.specializationLevels ?? [ref(UG), ref(PG)],
  seo: state.specializationRobots === undefined ? null : { robotsIndex: state.specializationRobots },
});
const specialization = specializationNow();
const guides = ['bsc-computer-science', 'bsc-software-engineering'].map((slug, index) => ({
  id: slug, slug, name: index ? 'BSc Software Engineering' : 'BSc Computer Science',
  subject, subSubject: specialization, courseLevel: UG,
  shortName: 'BSc', qualificationName: 'Bachelor of Science', shortDescription: null,
  duration: { min: '3', max: '3', unit: 'YEARS' }, studyModes: [{ id: 'full-time', name: 'Full time', code: 'FULL_TIME' }],
  credits: null, featuredMedia: null, featured: false, displayOrder: index,
  selectedCountry: null, selectedTuition: null, selectedIntakes: [], scholarshipAvailable: null, availableCountryCount: 1,
}));
const offerings = Array.from({ length: 9 }, (_, index) => ({
  id: `programme-${index}`, slug: `university-${index % 3}-computer-science-${index}`, name: guides[index % 2].name,
  university: { name: `University ${index % 3}`, slug: `university-${index % 3}`, country: { name: 'United Kingdom', slug: 'uk', iso2Code: 'GB' }, campuses: [] },
  genericCourse: { ...guides[index % 2], status: 'PUBLISHED', subject: { ...subject, status: 'PUBLISHED' } },
  courseLevel: UG, campus: null, durationMin: '3', durationMax: '3', durationUnit: 'YEARS',
  tuitionMin: '25000', tuitionMax: '25000', tuitionCurrency: 'GBP', tuitionPeriod: 'YEAR',
  intakes: [], requirements: [], studyMode: 'FULL_TIME', courseCode: null,
}));
const options = {
  levels: [{ value: 'UG', label: "Bachelor's", count: 2 }],
  countries: [{ value: 'uk', label: 'United Kingdom', count: 2, currencyCode: 'GBP' }],
  subjects: [{ value: 'computing', label: 'Computing', count: 2 }],
  subSubjects: [{ value: 'computer-science', label: 'Computer Science', count: 2, subject: { slug: subject.slug, name: subject.name } }],
  studyModes: [{ value: 'FULL_TIME', label: 'Full time', count: 2 }],
  intakes: [{ value: 'september', label: 'September', count: 2, startMonth: 9, endMonth: 9 }],
  englishTests: [], extras: [], sorts: [{ value: 'name', label: 'Name A-Z' }],
  tuition: { enabled: false, country: null, currencyCode: null },
};
const faqs = ['Do I need maths?', 'Is it taught in English?', 'Can I work while I study?'].map((question, index) => ({
  id: `faq-${index}`, question, answer: `<p>Answer ${index + 1}.</p>`,
}));
/** A Bachelor's page an editor has written and published, with its own SEO. */
const written = (over: Partial<SubjectLevelPageData> = {}): SubjectLevelPageData => ({
  subject: { id: subject.id, name: subject.name, slug: subject.slug },
  specialization: null,
  level: { id: 'ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: null },
  content: {
    id: 'page-1',
    intro: '<p>Why a Bachelor’s in Computing pays off.</p>',
    admissionNote: '<p>Entry asks for maths.</p>',
    careersNote: '<p>Graduates go into software.</p>',
    faqs,
    updatedAt: '2026-10-17T00:00:00.000Z',
  },
  hasOwnContent: true,
  seo: {
    seoTitle: 'Computing degrees abroad',
    metaDescription: 'What a Computing degree abroad involves.',
    canonicalUrl: '/subjects/computing/bachelors',
    robotsIndex: true,
    robotsFollow: true,
    source: { title: 'manual', description: 'manual', canonical: 'fallback' },
  },
  ...over,
});

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND'); },
  permanentRedirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));
vi.mock('@/components/reference/CourseGuidesResults', () => ({
  CourseGuidesResults: (props: CourseGuidesResultsProps) => {
    renders.guides(props);
    return <div data-testid="guide-results">{props.meta.total} course guides{props.courses.length ? null : props.empty}</div>;
  },
}));
vi.mock('./ProgrammeResults', () => ({
  ProgrammeResults: (props: ProgrammeResultsProps) => {
    renders.programmes(props);
    return <div data-testid="programme-results">{props.meta.total} programmes{props.cards.length ? null : props.empty}</div>;
  },
}));
vi.mock('./CourseCompare', () => ({ CompareTray: () => null }));
vi.mock('./PlanBand', () => ({
  PlanBand: ({ heading, secondary, more }: { heading: string; secondary?: { href: string; label: string }; more?: Array<{ href: string; label: string }> }) => (
    <aside data-testid="plan">
      <h2>{heading}</h2>
      {[secondary, ...(more ?? [])].flatMap((link) => (link ? [<a className="plan-link" key={link.href} href={link.href}>{link.label}</a>] : []))}
    </aside>
  ),
}));
vi.mock('@/lib/catalog', () => ({
  getSubject: vi.fn(async (slug: string) => slug === subject.slug ? subjectNow() : null),
  getSpecialization: vi.fn(async (slug: string, child: string) => slug === subject.slug && child === specialization.slug ? specializationNow() : null),
  getCourseLevels: vi.fn(async () => levels.map((level) => (level.code === 'UG' ? { ...level, description: state.ugDescription } : level))),
  getCourseFilterOptions: vi.fn(async () => state.optionsMissing ? null : options),
  getCourses: vi.fn(async (params: Record<string, string>) => ({
    data: state.empty ? [] : guides.slice(0, Number(params.pageSize ?? 12)),
    meta: { page: Number(params.page ?? 1), limit: Number(params.pageSize ?? 12), total: state.empty ? 0 : 2, totalPages: state.empty ? 0 : Math.ceil(2 / Number(params.pageSize ?? 12)) },
  })),
  getSubjectLevelPage: vi.fn(async () => {
    if (!state.levelPage) throw new Error('Level page not found');
    return state.levelPage;
  }),
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: vi.fn(async () => {
    if (state.programmesMissing) throw new Error('API unavailable');
    const total = state.empty ? 0 : state.total;
    return {
      data: offerings.slice(0, total),
      meta: { page: 1, limit: 18, total, totalPages: total ? 1 : 0 },
      summary: { programmes: total, universities: total ? 3 : 0, cities: total ? 2 : 0, countries: total ? 2 : 0 },
      facets: {
        countries: [], universities: [], cities: [], subjects: [], levels: [],
        specializations: total ? [
          { value: 'computer-science', label: 'Computer Science', count: 6 },
          { value: 'data-science', label: 'Data Science', count: 0 },
        ] : [],
        intakes: total ? [{ value: 'september', label: 'September', count: total }] : [],
        durations: total ? [{ value: '24', label: '1–2 years', count: total }] : [],
        studyModes: [], englishTests: [], status: [], extras: [],
        courses: [{ value: guides[0].slug, label: guides[0].name, count: total ? 6 : 0 }],
      },
      ignored: [],
    };
  }),
}));

const catalogue = await import('@/lib/catalog');
const { phaseProgrammes } = await import('@/lib/phase1');
const { SubjectLevelPage, subjectLevelMetadata } = await import('./SubjectLevelPage');
type Params = Parameters<typeof SubjectLevelPage>[0];
const render = async (search: Record<string, string | string[] | undefined> = {}, over: Partial<Awaited<Params['params']>> = {}) =>
  renderToStaticMarkup(await SubjectLevelPage({
    params: Promise.resolve({ slug: 'computing', levelSlug: 'bachelors', ...over }),
    searchParams: Promise.resolve(search),
  }));
const metadata = (search: Record<string, string | string[] | undefined> = {}, over: Partial<Awaited<Params['params']>> = {}) =>
  subjectLevelMetadata(Promise.resolve({ slug: 'computing', levelSlug: 'bachelors', ...over }), Promise.resolve(search));
const lastProgrammes = () => renders.programmes.mock.calls.at(-1)![0] as ProgrammeResultsProps;
const lastGuides = () => renders.guides.mock.calls.at(-1)![0] as CourseGuidesResultsProps;
const absolute = (path: string) => new URL(path, siteOrigin).toString();
/** The /programmes reads that list the page, not the course guides' check. */
const listReads = () => vi.mocked(phaseProgrammes).mock.calls.filter(([params]) => !params?.course);
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]) as Record<string, unknown>);
const barHrefs = (html: string) =>
  [...(html.match(/<nav class="levelbar levelbar--wide"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '').matchAll(/href="([^"?]+)/g)].map((match) => match[1]);

beforeEach(() => {
  vi.clearAllMocks();
  for (const map of memo.maps) map.clear();
  state.empty = false;
  state.optionsMissing = false;
  state.programmesMissing = false;
  state.total = 9;
  state.ugDescription = null;
  state.bare = false;
  state.subjectRobots = true;
  state.specializationRobots = undefined;
  state.specializationLevels = null;
  state.levelPage = null;
});

describe('a subject or specialization at one study level', () => {
  it('keeps the path subject and level fixed while passing destination and paging filters through', async () => {
    const html = await render({ subject: 'law', level: 'PG', courseLevel: 'PHD', country: 'uk', q: 'computer', page: '2' });
    expect(html).toContain('Bachelor&#x27;s in Computing');
    const asked = vi.mocked(phaseProgrammes).mock.calls[0][0];
    expect(asked).toMatchObject({ subject: 'computing', level: 'UG', within: 'level,subject', country: 'uk', q: 'computer', limit: '36' });
    const props = lastProgrammes();
    expect(props.base).toBe('/subjects/computing/bachelors');
    expect(props.scope).toEqual({ subject: ['computing'], level: ['UG'] });
    expect(props.filters).toMatchObject({ subject: [], level: [], country: ['uk'], q: 'computer', page: 2 });
    expect(props.suggestions).toContain('subject=computing');
    expect(props.suggestions).toContain('level=UG');
    expect(props.cards).toHaveLength(9);
  });

  it('pins the specialization and subject pair in programme and guide API calls', async () => {
    const html = await render({ view: 'guides', subject: 'law', specialization: 'criminal-law', subSubject: 'finance', level: 'PHD', country: 'uk', page: '2', pageSize: '1' }, { specializationSlug: 'computer-science' });
    expect(html).toContain('Bachelor&#x27;s in Computer Science');
    expect(vi.mocked(phaseProgrammes).mock.calls[0][0]).toMatchObject({
      subject: 'computing', specialization: 'computer-science', level: 'UG', within: 'level,subject,specialization', country: 'uk',
    });
    const guideCalls = vi.mocked(catalogue.getCourses).mock.calls.map(([params]) => params);
    expect(guideCalls).toContainEqual(expect.objectContaining({ subject: 'computing', subSubject: 'computer-science', level: 'UG', country: 'uk', page: '2' }));
    expect(guideCalls.every((params) => params?.subject === 'computing' && params?.level === 'UG' && params?.subSubject === 'computer-science')).toBe(true);
    const props = lastGuides();
    expect(props.base).toBe('/subjects/computing/computer-science/bachelors');
    expect(props.scope).toEqual({ subject: ['computing'], subSubject: ['computer-science'], level: ['UG'] });
    expect(props.filters).toMatchObject({ subject: [], subSubject: [], level: [], country: ['uk'], page: 2 });
    expect(props.paged).toBe(true);
    expect(props.viewParam).toBe(true);
    expect(props.taught).toEqual([guides[0].slug]);
  });

  it('keeps two guide identities separate from nine university programmes', async () => {
    const html = await render({ view: 'guides' });
    expect(html).toMatch(/data-testid="switch-programmes"[^>]*>.*?Programmes.*?\(9\)/);
    expect(html).toMatch(/data-testid="switch-guides"[^>]*>.*?Course guides.*?\(2\)/);
    expect(lastGuides().meta.total).toBe(2);
    expect(renders.programmes).not.toHaveBeenCalled();
    expect(lastGuides().programmes).toBe(true);
  });

  it('does not erase a valid empty path level absent from course filter options', async () => {
    state.empty = true;
    const html = await render({ view: 'guides', level: 'UG' }, { levelSlug: 'mba' });
    expect(html).toContain('MBA in Computing');
    expect(vi.mocked(phaseProgrammes).mock.calls[0][0]).toMatchObject({ subject: 'computing', level: 'MBA' });
    expect(vi.mocked(catalogue.getCourses).mock.calls.every(([params]) => params?.level === 'MBA')).toBe(true);
    expect(lastGuides().scope?.level).toEqual(['MBA']);
    expect(lastGuides().courses).toEqual([]);
    expect(lastGuides().meta.total).toBe(0);
    /* The bar offers the levels the subject is offered at -- its ticks,
       its branches' levels and its courses' -- and no other. */
    expect(barHrefs(html)).toEqual(['/subjects/computing/bachelors', '/subjects/computing/masters', '/subjects/computing/mba']);
    for (const slug of ['foundation', 'pathway', 'phd'])
      expect(html).not.toContain(`/subjects/computing/${slug}`);
  });

  it.each([
    { slug: 'unknown-subject' },
    { specializationSlug: 'unknown-specialization' },
    { slug: 'law', specializationSlug: 'computer-science' },
    { levelSlug: 'unknown-level' },
    /* A catalogue level the subject is not offered at. */
    { levelSlug: 'phd' },
    /* Offered on the subject, not on the specialization. */
    { specializationSlug: 'computer-science', levelSlug: 'mba' },
  ])('404s instead of broadening an invalid path (%j)', async (params) => {
    await expect(render({}, params)).rejects.toThrow('NOT_FOUND');
    expect(phaseProgrammes).not.toHaveBeenCalled();
    expect(catalogue.getCourses).not.toHaveBeenCalled();
  });

  /* A level switched off in Admin is not in the catalogue's list, though
     the courses filed at it still count towards a field's levels. A field
     offered there alone claimed it, had a page at no level and was a 404
     at every one. */
  it('treats a field offered only at a switched-off level as offered at nothing', async () => {
    state.specializationLevels = [{ id: 'diploma', code: 'DIPLOMA', name: 'Diploma' }];
    const html = await render({}, { specializationSlug: 'computer-science' });
    expect(html).toContain('Bachelor&#x27;s in Computer Science');
    expect(barHrefs(html)).toEqual(
      ['foundation', 'pathway', 'bachelors', 'masters', 'mba', 'phd'].map((slug) => `/subjects/computing/computer-science/${slug}`),
    );
    expect(html).not.toContain('/computer-science/diploma');
    /* Shown, not claimed: kept out of the index. */
    expect((await metadata({}, { specializationSlug: 'computer-science' })).robots).toMatchObject({ index: false });
  });

  it('404s an alias for a level the field is not offered at, rather than redirecting to one', async () => {
    state.specializationLevels = [ref(UG)];
    await expect(render({ country: 'uk' }, { specializationSlug: 'computer-science', levelSlug: 'pg' })).rejects.toThrow('NOT_FOUND');
    expect(phaseProgrammes).not.toHaveBeenCalled();
  });

  it.each([['ug', 'bachelors'], ['pg', 'masters']])('redirects %s to %s while preserving nonfixed filters', async (alias, canonical) => {
    try {
      await render({ subject: 'law', specialization: 'finance', subSubject: 'business', level: 'PHD', courseLevel: 'MBA', country: 'uk', q: ['computer', 'science'], view: 'guides', page: '2', ielts: '6.5' }, { specializationSlug: 'computer-science', levelSlug: alias });
      throw new Error('Expected a redirect');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const redirect = new URL((error as Error).message.replace('REDIRECT:', ''), 'https://universta.test');
      expect(redirect.pathname).toBe(`/subjects/computing/computer-science/${canonical}`);
      expect(redirect.searchParams.getAll('q')).toEqual(['computer', 'science']);
      expect(redirect.searchParams.get('country')).toBe('uk');
      expect(redirect.searchParams.get('page')).toBe('2');
      expect(redirect.searchParams.get('view')).toBe('guides');
      expect(redirect.searchParams.get('ielts')).toBe('6.5');
      for (const fixed of ['subject', 'specialization', 'subSubject', 'level', 'courseLevel'])
        expect(redirect.searchParams.has(fixed)).toBe(false);
    }
    expect(phaseProgrammes).not.toHaveBeenCalled();
  });

  it('with nothing offered, still renders the six named levels but keeps them out of the index', async () => {
    state.bare = true;
    const html = await render({}, { levelSlug: 'phd' });
    expect(html).toContain('PhD in Computing');
    expect(barHrefs(html)).toEqual(['foundation', 'pathway', 'bachelors', 'masters', 'mba', 'phd'].map((slug) => `/subjects/computing/${slug}`));
    expect(await metadata({}, { levelSlug: 'phd' })).toMatchObject({ robots: { index: false, follow: true } });
    /* Only the six: any other catalogue level is not a page here. */
    await expect(render({}, { levelSlug: 'unknown-level' })).rejects.toThrow('NOT_FOUND');
  });

  it('shows read failure as unavailable while preserving the fixed page and browse paths', async () => {
    state.programmesMissing = true;
    const html = await render();
    expect(html).toContain('Programmes are temporarily unavailable.');
    expect(html).toContain('href="/subjects/computing/bachelors"');
    expect(renders.programmes).not.toHaveBeenCalled();
    expect(html).not.toContain('statstrip');
  });

  it('reads the programmes once for the metadata and the page together', async () => {
    for (const search of [{}, { country: 'uk', q: 'computer' }]) {
      vi.clearAllMocks();
      for (const map of memo.maps) map.clear();
      await metadata(search);
      await render(search);
      expect(listReads()).toHaveLength(1);
    }
  });
});

describe('the level page’s hero', () => {
  it('leads with the level as Admin describes it, or the fixed line', async () => {
    expect(await render()).toContain('<p class="hero__sub">Explore published programmes by destination, university, fees, intake and entry requirements.</p>');
    vi.clearAllMocks();
    for (const map of memo.maps) map.clear();
    state.ugDescription = '  A first degree, three or four years long.  ';
    expect(await render()).toContain('<p class="hero__sub">A first degree, three or four years long.</p>');
  });

  it('states the level’s figures between the lead and the level bar', async () => {
    const html = await render();
    expect(html).toContain('statstrip statstrip--field statstrip--n5');
    const strip = html.slice(html.indexOf('statstrip--n5'), html.indexOf('levelbar levelbar--wide'));
    expect([...strip.matchAll(/<b[^>]*>([^<]+)<\/b><span>([^<]+)<\/span>/g)].map((match) => `${match[1]} ${match[2]}`)).toEqual([
      '9 Programmes', '3 Universities', '2 Destinations', 'Sep Intakes', '1–2 years Duration',
    ]);
    expect(html.indexOf('hero__sub')).toBeLessThan(html.indexOf('statstrip'));
  });

  it('draws no strip where nothing is listed', async () => {
    state.empty = true;
    expect(await render()).not.toContain('statstrip');
  });

  it('hands a subject’s reader on to its specializations at the level, counted', async () => {
    const html = await render();
    expect(html).toContain('Specializations at Bachelor&#x27;s');
    expect(html).toContain('<a class="specchip specchip--live" href="/subjects/computing/computer-science/bachelors">Computer Science<em>6</em></a>');
    expect(html).toContain('<a class="specchip" href="/subjects/computing/data-science/bachelors">Data Science</a>');
    expect(html).not.toContain('law-tech');
    expect(html).not.toContain('class="levelup"');
  });

  it('hands a specialization’s reader on to its siblings and up to its subject', async () => {
    const html = await render({}, { specializationSlug: 'computer-science' });
    expect(html).toContain('Other Computing specializations at Bachelor&#x27;s');
    expect(html).toContain('href="/subjects/computing/data-science/bachelors"');
    expect(html).not.toContain('href="/subjects/computing/computer-science/bachelors">Computer Science');
    const chips = html.slice(html.indexOf('specchips'), html.indexOf('</section>'));
    expect(chips).not.toContain('<em>');
    expect(html).toMatch(/<p class="levelup"><a class="linkcta" href="\/subjects\/computing\/bachelors">Bachelor&#x27;s in Computing/);
  });
});

describe('a level with nothing listed', () => {
  it('says the catalogue has none yet and shows the ways on', async () => {
    state.empty = true;
    const html = await render();
    expect(html).toContain('Not in our catalogue yet');
    expect(html).toMatch(/<a class="linkcta" href="\/subjects\/computing">Computing at every study level/);
    /* No guide to switch to, so no link to the empty guides view. */
    expect(html).not.toContain('Course guides for Bachelor&#x27;s in Computing');
  });

  it('offers the course guides when the level has some, and from a specialization its subject', async () => {
    state.total = 0;
    const html = await render({}, { specializationSlug: 'computer-science' });
    expect(html).toContain('Course guides for Bachelor&#x27;s in Computer Science');
    expect(html).toMatch(/<a class="linkcta" href="\/subjects\/computing\/computer-science">Computer Science at every study level/);
    expect(html).toMatch(/<a class="linkcta" href="\/subjects\/computing\/bachelors">Bachelor&#x27;s in Computing/);
  });

  it('tells the guides where they are', async () => {
    await render({ view: 'guides' });
    expect(lastGuides().where).toBe("for Computing at Bachelor's");
  });
});

describe('the closing band and the structured data', () => {
  it('offers the subject from a subject’s page', async () => {
    const html = await render();
    expect([...html.matchAll(/class="plan-link" href="([^"]+)">([^<]+)</g)].map((match) => [match[1], match[2]])).toEqual([
      ['/subjects/computing', 'View subject'],
    ]);
  });

  it('offers the specialization, then the subject, from a specialization’s page', async () => {
    const html = await render({}, { specializationSlug: 'computer-science' });
    expect([...html.matchAll(/class="plan-link" href="([^"]+)">([^<]+)</g)].map((match) => [match[1], match[2]])).toEqual([
      ['/subjects/computing/computer-science', 'View specialization'],
      ['/subjects/computing', 'View subject'],
    ]);
  });

  it('gives the crumbs as a BreadcrumbList of absolute addresses, the page at its canonical path', async () => {
    const html = await render({ country: 'uk' }, { specializationSlug: 'computer-science' });
    const crumbs = jsonLd(html).find((data) => data['@type'] === 'BreadcrumbList')!;
    const items = crumbs.itemListElement as Array<{ name: string; item: string }>;
    expect(items.map((item) => item.name)).toEqual(['Home', 'Subjects', 'Computing', 'Computer Science', "Bachelor's"]);
    expect(items.at(-1)!.item).toBe(absolute('/subjects/computing/computer-science/bachelors'));
    expect(items[0].item).toBe(absolute('/'));
  });
});

describe('subject level metadata', () => {
  it('canonicals the base path while ignoring conflicting copies of its fixed dimensions', async () => {
    const meta = await metadata({ subject: 'law', level: 'PHD' });
    expect(meta.alternates).toEqual({ canonical: absolute('/subjects/computing/bachelors') });
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.title).toEqual({ absolute: "Bachelor's in Computing | Universta" });
  });

  it.each([{ q: 'computer' }, { country: 'uk' }, { page: '2' }, { view: 'guides' }, { specialization: 'computer-science' }])('keeps narrowed queries out of the index (%j)', async (query) => {
    const meta = await metadata(query);
    expect(meta.alternates).toBeUndefined();
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it('uses the nested canonical and excludes a missing field from indexing', async () => {
    const scoped = await metadata({ specialization: 'other' }, { specializationSlug: 'computer-science', levelSlug: 'pg' });
    expect(scoped.alternates).toEqual({ canonical: absolute('/subjects/computing/computer-science/masters') });
    expect(scoped.title).toEqual({ absolute: "Master's in Computer Science | Universta" });
    const missing = await metadata({}, { slug: 'missing' });
    expect(missing.robots).toEqual({ index: false, follow: true });
  });

  it('makes no programme read for an alias, which only redirects', async () => {
    await metadata({}, { levelSlug: 'ug' });
    expect(phaseProgrammes).not.toHaveBeenCalled();
  });

  it('indexes a level with three programmes or more, and not one with two', async () => {
    state.total = 3;
    expect((await metadata()).robots).toEqual({ index: true, follow: true });
    for (const map of memo.maps) map.clear();
    state.total = 2;
    const thin = await metadata();
    expect(thin.robots).toEqual({ index: false, follow: true });
    /* Still the page, so still its canonical. */
    expect(thin.alternates).toEqual({ canonical: absolute('/subjects/computing/bachelors') });
  });

  it('keeps a level out of the index when its programmes could not be read', async () => {
    state.programmesMissing = true;
    expect((await metadata()).robots).toEqual({ index: false, follow: true });
  });

  it.each([
    ['the subject', () => { state.subjectRobots = false; }, {}],
    ['the specialization', () => { state.specializationRobots = false; }, { specializationSlug: 'computer-science' }],
    ['the level page', () => { state.levelPage = written({ seo: { ...written().seo!, robotsIndex: false } }); }, {}],
  ])('keeps a level out of the index when %s says so', async (_, set, over) => {
    set();
    expect((await metadata({}, over)).robots).toMatchObject({ index: false });
  });

  it('describes the level by what it lists', async () => {
    expect((await metadata()).description).toBe(
      "Compare 9 programmes for Bachelor's in Computing at 3 universities in 2 destinations, with the fees, intakes and entry requirements each one lists.",
    );
    for (const map of memo.maps) map.clear();
    state.empty = true;
    expect((await metadata()).description).toContain('is listed on Universta yet');
  });
});

describe('what an editor writes for a level page', () => {
  it('draws the intro under the hero and the notes and questions after the list', async () => {
    state.levelPage = written();
    const html = await render();
    const at = (marker: string) => html.indexOf(marker);
    expect(html).toContain('Why a Bachelor’s in Computing pays off.');
    expect(at('id="overview"')).toBeGreaterThan(at('class="hero hero--compact"'));
    expect(at('id="overview"')).toBeLessThan(at('id="discovery"'));
    expect(at('id="discovery"')).toBeLessThan(at('id="admission"'));
    expect(at('id="admission"')).toBeLessThan(at('id="careers"'));
    expect(at('id="careers"')).toBeLessThan(at('id="faqs"'));
    expect(at('id="faqs"')).toBeLessThan(at('data-testid="plan"'));
    expect(html).toContain('Getting into Bachelor&#x27;s in Computing');
    expect(html).toContain('Where Bachelor&#x27;s in Computing can lead');
    expect(html).toContain('Questions about Bachelor&#x27;s in Computing');
    /* Paper and white alternate from the white list above. */
    expect(html).toMatch(/<section class="sec sec--paper" id="admission">/);
    expect(html).toMatch(/<section class="sec sec--white" id="careers">/);
    expect(html).toMatch(/<section class="sec sec--paper" id="faqs">/);
    const questions = jsonLd(html).find((data) => data['@type'] === 'FAQPage')!;
    expect((questions.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((entry) => [entry.name, entry.acceptedAnswer.text])).toEqual([
      ['Do I need maths?', 'Answer 1.'],
      ['Is it taught in English?', 'Answer 2.'],
      ['Can I work while I study?', 'Answer 3.'],
    ]);
  });

  it('draws each part only where something is written', async () => {
    state.levelPage = written({
      content: { ...written().content!, intro: '<p> </p>', careersNote: null, faqs: [] },
    });
    const html = await render();
    expect(html).not.toContain('id="overview"');
    expect(html).toContain('id="admission"');
    expect(html).not.toContain('id="careers"');
    expect(html).not.toContain('id="faqs"');
    expect(jsonLd(html).some((data) => data['@type'] === 'FAQPage')).toBe(false);
    /* The one band left opens on paper. */
    expect(html).toMatch(/<section class="sec sec--paper" id="admission">/);
  });

  it('draws nothing of a page that is not published', async () => {
    state.levelPage = written({ content: null, hasOwnContent: false });
    const html = await render();
    for (const id of ['overview', 'admission', 'careers', 'faqs']) expect(html).not.toContain(`id="${id}"`);
  });

  it('ignores a page for another level', async () => {
    state.levelPage = written({ level: { id: 'pg', code: 'PG', name: "Master's", slug: 'masters', description: null } });
    const html = await render();
    expect(html).not.toContain('id="overview"');
    expect((await metadata()).title).toEqual({ absolute: "Bachelor's in Computing | Universta" });
  });

  it('takes the title and description an editor or the template wrote, and not the fallback', async () => {
    state.levelPage = written();
    const meta = await metadata();
    expect(meta.title).toEqual({ absolute: 'Computing degrees abroad | Universta' });
    expect(meta.description).toBe('What a Computing degree abroad involves.');
    for (const map of memo.maps) map.clear();
    state.levelPage = written({ seo: { ...written().seo!, source: { title: 'bulk', description: 'fallback', canonical: 'fallback' } } });
    const bulk = await metadata();
    expect(bulk.title).toEqual({ absolute: 'Computing degrees abroad | Universta' });
    expect(bulk.description).toContain('Compare 9 programmes');
    for (const map of memo.maps) map.clear();
    state.levelPage = written({ seo: { ...written().seo!, source: { title: 'fallback', description: 'default', canonical: 'fallback' } } });
    const fallback = await metadata();
    expect(fallback.title).toEqual({ absolute: "Bachelor's in Computing | Universta" });
    expect(fallback.description).toContain('Compare 9 programmes');
  });

  it('takes a canonical only where an editor or the template set one', async () => {
    const seo = { ...written().seo!, canonicalUrl: '/subjects/computing/computing-degrees' };
    state.levelPage = written({ seo: { ...seo, source: { title: 'manual', description: 'manual', canonical: 'manual' } } });
    expect((await metadata()).alternates).toEqual({ canonical: absolute('/subjects/computing/computing-degrees') });
    for (const map of memo.maps) map.clear();
    state.levelPage = written({ seo: { ...seo, source: { title: 'manual', description: 'manual', canonical: 'fallback' } } });
    expect((await metadata()).alternates).toEqual({ canonical: absolute('/subjects/computing/bachelors') });
    /* A narrowed address has none, whoever set it. */
    for (const map of memo.maps) map.clear();
    state.levelPage = written({ seo: { ...seo, source: { title: 'manual', description: 'manual', canonical: 'manual' } } });
    const narrowed = await metadata({ country: 'uk' });
    expect(narrowed.alternates).toBeUndefined();
    expect(narrowed.robots).toMatchObject({ index: false });
  });

  it('indexes a written page with fewer than three programmes', async () => {
    state.total = 2;
    state.levelPage = written();
    expect((await metadata()).robots).toEqual({ index: true, follow: true });
    for (const map of memo.maps) map.clear();
    state.levelPage = written({ hasOwnContent: false });
    expect((await metadata()).robots).toEqual({ index: false, follow: true });
  });

  it('follows its own robots follow setting', async () => {
    state.levelPage = written({ seo: { ...written().seo!, robotsFollow: false } });
    expect((await metadata()).robots).toEqual({ index: true, follow: false });
  });
});

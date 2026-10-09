import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseGuidesResultsProps } from '@/components/reference/CourseGuidesResults';
import type { ProgrammeResultsProps } from './ProgrammeResults';

const state = vi.hoisted(() => ({ empty: false, optionsMissing: false, programmesMissing: false }));
const renders = vi.hoisted(() => ({ programmes: vi.fn(), guides: vi.fn() }));
const levels = [
  { code: 'FOUNDATION', name: 'Foundation' },
  { code: 'PATHWAY', name: 'Pathway' },
  { code: 'UG', name: "Bachelor's" },
  { code: 'PG', name: "Master's" },
  { code: 'MBA', name: 'MBA' },
  { code: 'PHD', name: 'PhD' },
].map((level, index) => ({ ...level, id: level.code.toLowerCase(), description: null, educationOrder: index + 1 }));
const subject = { id: 'computing', slug: 'computing', name: 'Computing', seo: { robotsIndex: true } };
const specialization = { id: 'cs', slug: 'computer-science', name: 'Computer Science', subject };
const guides = ['bsc-computer-science', 'bsc-software-engineering'].map((slug, index) => ({
  id: slug, slug, name: index ? 'BSc Software Engineering' : 'BSc Computer Science',
  subject, subSubject: specialization, courseLevel: levels[2],
  shortName: 'BSc', qualificationName: 'Bachelor of Science', shortDescription: null,
  duration: { min: '3', max: '3', unit: 'YEARS' }, studyModes: [{ id: 'full-time', name: 'Full time', code: 'FULL_TIME' }],
  credits: null, featuredMedia: null, featured: false, displayOrder: index,
  selectedCountry: null, selectedTuition: null, selectedIntakes: [], scholarshipAvailable: null, availableCountryCount: 1,
}));
const offerings = Array.from({ length: 9 }, (_, index) => ({
  id: `programme-${index}`, slug: `university-${index % 3}-computer-science-${index}`, name: guides[index % 2].name,
  university: { name: `University ${index % 3}`, slug: `university-${index % 3}`, country: { name: 'United Kingdom', slug: 'uk', iso2Code: 'GB' }, campuses: [] },
  genericCourse: { ...guides[index % 2], status: 'PUBLISHED', subject: { ...subject, status: 'PUBLISHED' } },
  courseLevel: levels[2], campus: null, durationMin: '3', durationMax: '3', durationUnit: 'YEARS',
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

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND'); },
  permanentRedirect: (url: string) => { throw new Error(`REDIRECT:${url}`); },
}));
vi.mock('@/components/reference/CourseGuidesResults', () => ({
  CourseGuidesResults: (props: CourseGuidesResultsProps) => {
    renders.guides(props);
    return <div data-testid="guide-results">{props.meta.total} course guides</div>;
  },
}));
vi.mock('./ProgrammeResults', () => ({
  ProgrammeResults: (props: ProgrammeResultsProps) => {
    renders.programmes(props);
    return <div data-testid="programme-results">{props.meta.total} programmes</div>;
  },
}));
vi.mock('./CourseCompare', () => ({ CompareTray: () => null }));
vi.mock('./PlanBand', () => ({ PlanBand: ({ title }: { title: string }) => <aside>{title}</aside> }));
vi.mock('@/lib/catalog', () => ({
  getSubject: vi.fn(async (slug: string) => slug === subject.slug ? subject : null),
  getSpecialization: vi.fn(async (slug: string, child: string) => slug === subject.slug && child === specialization.slug ? specialization : null),
  getCourseLevels: vi.fn(async () => levels),
  getCourseFilterOptions: vi.fn(async () => state.optionsMissing ? null : options),
  getCourses: vi.fn(async (params: Record<string, string>) => ({
    data: state.empty ? [] : guides.slice(0, Number(params.pageSize ?? 12)),
    meta: { page: Number(params.page ?? 1), limit: Number(params.pageSize ?? 12), total: state.empty ? 0 : 2, totalPages: state.empty ? 0 : Math.ceil(2 / Number(params.pageSize ?? 12)) },
  })),
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: vi.fn(async () => {
    if (state.programmesMissing) throw new Error('API unavailable');
    return {
      data: state.empty ? [] : offerings,
      meta: { page: 1, limit: 18, total: state.empty ? 0 : 9, totalPages: state.empty ? 0 : 1 },
      summary: { programmes: state.empty ? 0 : 9, universities: state.empty ? 0 : 3, cities: state.empty ? 0 : 2 },
      facets: {
        countries: [], universities: [], cities: [], subjects: [], specializations: [], levels: [],
        intakes: [], durations: [], studyModes: [], englishTests: [], status: [], extras: [],
        courses: [{ value: guides[0].slug, label: guides[0].name, count: state.empty ? 0 : 6 }],
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

beforeEach(() => {
  vi.clearAllMocks();
  state.empty = false;
  state.optionsMissing = false;
  state.programmesMissing = false;
});

describe('a subject or specialization at one study level', () => {
  it('keeps the path subject and level fixed while passing destination and paging filters through', async () => {
    const html = await render({ subject: 'law', level: 'PG', courseLevel: 'PHD', country: 'uk', q: 'computer', page: '2' });
    expect(html).toContain('Bachelor&#x27;s in Computing');
    const asked = vi.mocked(phaseProgrammes).mock.calls[0][0];
    expect(asked).toMatchObject({ subject: 'computing', level: 'UG', within: 'level,subject', country: 'uk', q: 'computer', limit: '36' });
    const props = lastProgrammes();
    expect(props.base).toBe('/subjects/computing/levels/bachelors');
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
    expect(props.base).toBe('/subjects/computing/computer-science/levels/bachelors');
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
    for (const slug of ['foundation', 'pathway', 'bachelors', 'masters', 'mba', 'phd'])
      expect(html).toContain(`/subjects/computing/levels/${slug}`);
  });

  it.each([
    { slug: 'unknown-subject' },
    { specializationSlug: 'unknown-specialization' },
    { slug: 'law', specializationSlug: 'computer-science' },
    { levelSlug: 'unknown-level' },
  ])('404s instead of broadening an invalid path (%j)', async (params) => {
    await expect(render({}, params)).rejects.toThrow('NOT_FOUND');
    expect(phaseProgrammes).not.toHaveBeenCalled();
    expect(catalogue.getCourses).not.toHaveBeenCalled();
  });

  it.each([['ug', 'bachelors'], ['pg', 'masters']])('redirects %s to %s while preserving nonfixed filters', async (alias, canonical) => {
    try {
      await render({ subject: 'law', specialization: 'finance', subSubject: 'business', level: 'PHD', courseLevel: 'MBA', country: 'uk', q: ['computer', 'science'], view: 'guides', page: '2', ielts: '6.5' }, { specializationSlug: 'computer-science', levelSlug: alias });
      throw new Error('Expected a redirect');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const redirect = new URL((error as Error).message.replace('REDIRECT:', ''), 'https://universta.test');
      expect(redirect.pathname).toBe(`/subjects/computing/computer-science/levels/${canonical}`);
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

  it('shows read failure as unavailable while preserving the fixed page and browse paths', async () => {
    state.programmesMissing = true;
    const html = await render();
    expect(html).toContain('Programmes are temporarily unavailable.');
    expect(html).toContain('href="/subjects/computing/levels/bachelors"');
    expect(renders.programmes).not.toHaveBeenCalled();
  });
});

describe('subject level metadata', () => {
  it('canonicals the base path while ignoring conflicting copies of its fixed dimensions', async () => {
    const meta = await metadata({ subject: 'law', level: 'PHD' });
    expect(meta.alternates).toEqual({ canonical: '/subjects/computing/levels/bachelors' });
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
    expect(scoped.alternates).toEqual({ canonical: '/subjects/computing/computer-science/levels/masters' });
    expect(scoped.title).toEqual({ absolute: "Master's in Computer Science | Universta" });
    const missing = await metadata({}, { slug: 'missing' });
    expect(missing.robots).toEqual({ index: false, follow: true });
  });
});

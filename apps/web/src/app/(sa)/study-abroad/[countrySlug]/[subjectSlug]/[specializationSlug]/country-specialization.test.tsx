import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  sections: [] as unknown[],
  faqs: [] as unknown[],
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/study-abroad/japan/computer-science-it/artificial-intelligence',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('not found'); },
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openSelector: vi.fn() }),
}));
vi.mock('@/lib/study-abroad', () => ({
  getStudyAbroadCountry: async () => ({
    country: { id: 'jp', name: 'Japan', slug: 'japan', iso2Code: 'JP', subjects: [] },
    consultants: null,
  }),
}));
vi.mock('@/lib/country-tabs', () => ({
  loadCountryTabs: async () => [],
  tabCounts: () => ({ universities: 0, scholarships: 0 }),
}));
vi.mock('@/lib/study-abroad-view', () => ({ guideLinks: () => [] }));
vi.mock('@/lib/country-subject-related', () => ({
  specializationUniversities: async () => ({ total: 0, group: { title: 'Universities', items: [], total: 0 } }),
  scholarshipsGroup: async () => ({ title: 'Scholarships', items: [], total: 0 }),
  consultantsGroup: async () => ({ title: 'Consultants', items: [], total: 0 }),
}));

const levels = [
  { id: 'pg', code: 'PG', name: "Master's", educationOrder: 4 },
  { id: 'phd', code: 'PHD', name: 'PhD', educationOrder: 6 },
];

vi.mock('@/lib/catalog', () => ({
  getSpecialization: async () => ({
    id: 'ai',
    name: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
    shortDescription: 'Building systems that learn.',
    overview: 'AI studies how to build systems that perceive, reason and learn.',
    iconMedia: null,
    subject: { id: 'cs', name: 'Computer Science & IT', slug: 'computer-science-it', shortDescription: null },
    offeredLevels: levels,
    contentSections: fixture.sections,
    faqs: fixture.faqs,
    siblings: [],
    siblingTotal: 0,
    countries: [],
    courses: [],
  }),
  getCoursesByLevel: async () => [],
  getCourseFilterOptions: async () => ({ intakes: [], subSubjects: [] }),
  getCourseLevels: async () => levels,
  getCourses: async () => ({ data: [], meta: { total: 0 } }),
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: async () => ({
    data: [],
    meta: { page: 1, limit: 18, total: 0, totalPages: 0 },
    facets: { countries: [], subjects: [], universities: [], cities: [], intakes: [], specializations: [] },
    summary: { programmes: 0, universities: 0, cities: 0 },
  }),
}));

const { default: Page } = await import('./page');
const render = async () => renderToStaticMarkup(await Page({
  params: Promise.resolve({
    countrySlug: 'japan',
    subjectSlug: 'computer-science-it',
    specializationSlug: 'artificial-intelligence',
  }),
  searchParams: Promise.resolve({}),
}));
const section = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`);
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
};

const study = {
  id: 's1',
  sectionKey: 'what-you-study',
  sectionType: 'RICH_TEXT',
  heading: 'What you study in Artificial Intelligence',
  subheading: 'From statistics to deep learning',
  bodyJson: { paragraphs: ['Core modules cover machine learning and algorithms.'] },
  media: null,
  displayOrder: 1,
};
const careers = {
  id: 's2',
  sectionKey: 'career-outcomes',
  sectionType: 'CHECKLIST',
  heading: 'Career outcomes',
  subheading: null,
  bodyJson: { paragraphs: [], items: ['Machine learning engineer', 'AI research scientist'] },
  media: null,
  displayOrder: 2,
};

beforeEach(() => {
  fixture.sections = [];
  fixture.faqs = [];
});

describe('a specialization in a destination', () => {
  it('shows what you study and where it leads, after the overview and before the study levels', async () => {
    fixture.sections = [study, careers];
    const html = await render();
    expect(html.indexOf('id="about"')).toBeLessThan(html.indexOf('id="content-what-you-study"'));
    expect(html.indexOf('id="content-what-you-study"')).toBeLessThan(html.indexOf('id="content-career-outcomes"'));
    expect(html.indexOf('id="content-career-outcomes"')).toBeLessThan(html.indexOf('id="programs"'));
    const what = section(html, 'content-what-you-study');
    expect(what).toContain('<span class="eyebrow">What you study</span>');
    expect(what).toContain('<h2 class="sec-title">What you study in Artificial Intelligence</h2>');
    expect(what).toContain('<p class="sec-lead">From statistics to deep learning</p>');
    expect(what).toContain('Core modules cover machine learning and algorithms.');
    const jobs = section(html, 'content-career-outcomes');
    expect(jobs).toContain('<li>Machine learning engineer</li><li>AI research scientist</li>');
  });

  it('leaves out a section with nothing in it', async () => {
    fixture.sections = [{ ...study, bodyJson: { paragraphs: ['  '] } }];
    expect(await render()).not.toContain('id="content-what-you-study"');
  });

  it('answers its questions on the page', async () => {
    fixture.faqs = [{ id: 'f1', question: 'Can I study AI in Japan in English?', answer: 'Yes. Many programmes are taught in English.' }];
    const faqs = section(await render(), 'faqs');
    expect(faqs).toContain('Straight answers about Artificial Intelligence');
    expect(faqs).toContain('Can I study AI in Japan in English?');
    expect(faqs).toContain('Yes. Many programmes are taught in English.');
  });

  it('has no questions band without questions', async () => {
    expect(await render()).not.toContain('id="faqs"');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  description: null as string | null,
  country: { id: 'gb', name: 'United Kingdom', slug: 'uk', iso2Code: 'GB', subjects: [] },
  programmes: 1,
  guides: 1,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/study-abroad/uk/arts-humanities-social-sciences',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => { throw new Error('not found'); },
}));
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openSelector: vi.fn() }),
}));
vi.mock('@/lib/study-abroad', () => ({
  getStudyAbroadCountry: async () => ({ country: fixture.country, consultants: null }),
}));
vi.mock('@/lib/country-tabs', () => ({
  loadCountryTabs: async () => [],
  tabCounts: () => ({ universities: 0, scholarships: 0 }),
}));
vi.mock('@/lib/study-abroad-view', () => ({ guideLinks: () => [] }));
vi.mock('@/lib/university-related', () => ({
  subjectUniversitiesGroup: async () => ({ title: 'Universities', items: [], total: 0 }),
  subjectUniversitiesHref: (country: string, subject: string) =>
    `/study-abroad/${country}/universities?subjects=${subject}`,
}));

const subjectSlug = 'arts-humanities-social-sciences';
const subjectName = 'Arts, Humanities & Social Sciences';
const fallbackSubtitle = 'Explore universities, programmes, tuition fees, intakes and eligibility requirements.';
const specializations = Array.from({ length: 60 }, (_, index) => ({
  id: `spec-${index}`,
  name: `Specialization ${index + 1}`,
  slug: `specialization-${index + 1}`,
}));
const levels = [
  { code: 'FOUNDATION', name: 'Foundation' },
  { code: 'PATHWAY', name: 'Pathway' },
  { code: 'UG', name: "Bachelor's" },
  { code: 'PG', name: "Master's" },
  { code: 'MBA', name: 'MBA' },
  { code: 'PHD', name: 'PhD' },
].map((level, index) => ({ ...level, id: level.code.toLowerCase(), educationOrder: index + 1 }));

vi.mock('@/lib/catalog', () => ({
  getSubject: async () => ({
    id: subjectSlug,
    slug: subjectSlug,
    name: subjectName,
    shortDescription: fixture.description,
    overview: null,
    iconMedia: null,
    subSubjects: specializations,
  }),
  getCoursesByLevel: async () => fixture.guides ? [{
    level: levels[2],
    count: 1,
    courses: [{
      id: 'history', name: 'BA History', slug: 'ba-history', subSubject: null,
      duration: { min: '3', max: '3', unit: 'YEARS' }, studyModes: [],
      selectedTuition: null, availableCountryCount: 1, courseLevel: levels[2],
    }],
  }] : [],
  getCourseFilterOptions: async () => ({
    intakes: [],
    subSubjects: fixture.guides ? [{
      value: 'specialization-1', label: 'Specialization 1', count: 1,
      subject: { slug: subjectSlug },
    }] : [],
  }),
  getCourseLevels: async () => levels,
  getCourses: async () => ({ data: [], meta: { total: 0 } }),
}));
vi.mock('@/lib/phase1', () => ({
  phaseProgrammes: async () => ({
    data: fixture.programmes ? [{
      id: 'history-programme', slug: 'university-of-york-ba-history', name: 'BA History',
      genericCourse: { name: 'BA History', slug: 'ba-history', courseLevel: levels[2] },
      university: { name: 'University of York', slug: 'university-of-york', country: fixture.country },
    }] : [],
    meta: { page: 1, limit: 18, total: fixture.programmes, totalPages: fixture.programmes ? 1 : 0 },
    facets: {
      countries: [], subjects: [], universities: [], cities: [],
      intakes: fixture.programmes ? [{
        value: 'september', label: 'September', startMonth: 9, endMonth: 9, shortLabel: 'Sep', count: 1,
      }] : [],
      specializations: fixture.programmes ? [{ value: 'specialization-1', label: 'Specialization 1', count: 1 }] : [],
    },
    summary: {
      programmes: fixture.programmes, universities: fixture.programmes,
      cities: fixture.programmes ? 1 : 0,
    },
  }),
}));

const { default: Page } = await import('./page');
const render = async () => renderToStaticMarkup(await Page({
  params: Promise.resolve({ countrySlug: fixture.country.slug, subjectSlug }),
  searchParams: Promise.resolve({}),
}));
const section = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`);
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
};

beforeEach(() => {
  fixture.description = null;
  fixture.country = { id: 'gb', name: 'United Kingdom', slug: 'uk', iso2Code: 'GB', subjects: [] };
  fixture.programmes = 1;
  fixture.guides = 1;
});

describe('the ZIP-aligned country subject page', () => {
  it('uses the shorter UK heading while retaining the catalogue subject name', async () => {
    const html = await render();
    const heading = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1];
    expect(heading).toBe('Arts, Humanities &amp; Social Sciences courses in the UK');
    expect(html).toContain('href="/study-abroad/uk/subjects"');
    expect(html).not.toContain('Study Arts, Humanities &amp; Social Sciences in the United Kingdom</h1>');
  });

  it('uses the subject glyph when no uploaded icon is recorded', async () => {
    const html = await render();
    const hero = html.slice(html.indexOf('class="subjhero'), html.indexOf('</h1>'));
    expect(hero).toContain('<svg');
    expect(hero).not.toContain('M4 5h16v14H4z M4 9h16');
  });

  it('uses the recorded description when it is present, without adding a rank claim', async () => {
    fixture.description = 'Explore history and the human experience.';
    const html = await render();
    expect(html).toContain('Explore history and the human experience.');
    expect(html).not.toMatch(/QS top|top \d+ universit|ranked #/i);
    expect(html).not.toContain(fallbackSubtitle);
  });

  it.each([null, '   '])('uses the neutral ZIP subtitle for an empty description (%s)', async (description) => {
    fixture.description = description;
    const html = await render();
    expect(html).toContain(`<p class="hero__sub">${fallbackSubtitle}</p>`);
    expect(html).not.toMatch(/QS top|top \d+ universit|ranked #/i);
  });

  it('keeps the hero chips concise while the complete directory stays available', async () => {
    const html = await render();
    const hero = html.slice(0, html.indexOf('</section>'));
    expect(hero.match(/<a class="specchip(?: [^"]*)?" href="/g)).toHaveLength(6);
    expect(hero).toContain(`href="/study-abroad/uk/${subjectSlug}/specialization-1"`);
  });

  it('keeps the ZIP strip to four statistics and states taught specializations beside their chips', async () => {
    const html = await render();
    const hero = html.slice(0, html.indexOf('</section>'));
    const strip = hero.match(/<div class="statstrip[^"]*">(.*?)<\/div><\/div>/)?.[1] ?? '';
    const figures = [...strip.matchAll(/<b[^>]*>([^<]+)<\/b><span>([^<]+)<\/span>/g)]
      .map((cell) => `${cell[1]} ${cell[2]}`);
    expect(figures).toEqual(['1 Programme', '1 University', '1 City', 'Sep Intakes']);
    expect(hero).toContain('<span class="label">Specializations · 1 taught here</span>');
    expect(hero).toContain('Specialization 1<em>1</em>');
  });

  it('places the programme finder and guide levels before the full specialization directory', async () => {
    const html = await render();
    const afterHero = html.slice(html.indexOf('</section>') + '</section>'.length);
    expect(afterHero).toMatch(/^<section[^>]*id="courses">/);
    expect(html.indexOf('id="courses"')).toBeGreaterThan(html.indexOf('</h1>'));
    expect(html.indexOf('id="courses"')).toBeLessThan(html.indexOf('id="programs"'));
    expect(html.indexOf('id="programs"')).toBeLessThan(html.indexOf('id="specializations"'));
    expect(section(html, 'courses')).toContain('class="cresults"');
    expect(section(html, 'courses')).toContain('href="/study-abroad/uk/universities/university-of-york/courses/university-of-york-ba-history"');
  });

  it('retains the finder heading for assistive technology and the scoped search link after results', async () => {
    const finder = section(await render(), 'courses');
    expect(finder).toContain('<h2 class="sr-only">Arts, Humanities &amp; Social Sciences programmes in the United Kingdom</h2>');
    expect(finder.indexOf('Open in search')).toBeGreaterThan(finder.indexOf('class="cresults"'));
    expect(finder).toContain('href="/courses?country=uk&amp;subject=arts-humanities-social-sciences#discovery"');
  });

  it('keeps every specialization linked to this subject within this country', async () => {
    const html = await render();
    const directory = section(html, 'specializations');
    for (const entry of specializations) {
      expect(directory).toContain(`href="/study-abroad/uk/${subjectSlug}/${entry.slug}"`);
    }
    expect(directory.match(/class="h-card h-card--row"/g)).toHaveLength(60);
  });

  it('links the specialization CTA to the complete directory further down the section', async () => {
    const directory = section(await render(), 'specializations');
    expect(directory).toContain('href="#specialization-list"');
    expect(directory).toContain('id="specialization-list"');
    expect(directory.indexOf('href="#specialization-list"')).toBeLessThan(directory.indexOf('id="specialization-list"'));
    expect(directory.match(/class="h-card h-card--row"/g)).toHaveLength(60);
  });

  it('keeps the six study levels and the guide link scoped to the country and subject', async () => {
    const html = await render();
    for (const level of levels) expect(html).toContain(`id="level-${level.code.toLowerCase()}"`);
    expect(html).toContain('href="/courses?country=uk&amp;subject=arts-humanities-social-sciences&amp;level=UG&amp;view=guides"');
  });

  it('keeps the empty-country message and all six levels before the directory', async () => {
    fixture.programmes = 0;
    fixture.guides = 0;
    const html = await render();
    expect(html).not.toContain('id="courses"');
    expect(html).toContain('No Arts, Humanities &amp; Social Sciences course in the United Kingdom is listed on Universta yet.');
    expect(html.indexOf('id="programs"')).toBeLessThan(html.indexOf('id="specializations"'));
    for (const level of levels) expect(html).toContain(`id="level-${level.code.toLowerCase()}"`);
    expect(section(html, 'specializations').match(/class="h-card h-card--row"/g)).toHaveLength(60);
  });
});

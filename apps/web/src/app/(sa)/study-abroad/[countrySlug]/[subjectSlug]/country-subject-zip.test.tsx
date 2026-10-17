import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Level = { id: string; code: string; name: string };
const fixture = vi.hoisted(() => ({
  description: null as string | null,
  overview: null as string | null,
  /* What an editor ticked on the subject, and on its first specialization. */
  offered: [] as Level[],
  firstLevels: [] as Level[],
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
    overview: fixture.overview,
    iconMedia: null,
    offeredLevels: fixture.offered,
    subSubjects: specializations.map((entry, index) => ({
      ...entry,
      levels: index === 0 ? fixture.firstLevels : [],
    })),
  }),
  getCoursesByLevel: async () => fixture.guides ? [{
    level: levels[2],
    count: 1,
    courses: [{
      id: 'history', name: 'BA History', slug: 'ba-history',
      subSubject: { id: 'spec-0', name: 'Specialization 1', slug: 'specialization-1' },
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

const { default: Page, generateMetadata } = await import('./page');
const render = async () => renderToStaticMarkup(await Page({
  params: Promise.resolve({ countrySlug: fixture.country.slug, subjectSlug }),
  searchParams: Promise.resolve({}),
}));
const section = (html: string, id: string) => {
  const start = html.indexOf(`id="${id}"`);
  return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
};

const byCode = (code: string) => levels.find((level) => level.code === code)!;

beforeEach(() => {
  fixture.description = null;
  fixture.overview = null;
  fixture.offered = [];
  fixture.firstLevels = [];
  fixture.country = { id: 'gb', name: 'United Kingdom', slug: 'uk', iso2Code: 'GB', subjects: [] };
  fixture.programmes = 1;
  fixture.guides = 1;
});

describe('the ZIP-aligned country subject page', () => {
  it('heads the page with the subject, studied in the UK, and keeps "courses in" for the browser title', async () => {
    const html = await render();
    const heading = html.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1];
    expect(heading).toBe('Study Arts, Humanities &amp; Social Sciences in the UK');
    expect(html).toContain('href="/study-abroad/uk/subjects"');
    const meta = await generateMetadata({
      params: Promise.resolve({ countrySlug: fixture.country.slug, subjectSlug }),
      searchParams: Promise.resolve({}),
    });
    expect(meta.title).toEqual({
      absolute: 'Arts, Humanities & Social Sciences courses in the UK | Universta',
    });
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

  it('reads subject first: specializations, then study levels, then the programme finder', async () => {
    const html = await render();
    expect(html.indexOf('id="specializations"')).toBeGreaterThan(html.indexOf('</h1>'));
    expect(html.indexOf('id="specializations"')).toBeLessThan(html.indexOf('id="programs"'));
    expect(html.indexOf('id="programs"')).toBeLessThan(html.indexOf('id="courses"'));
    expect(section(html, 'courses')).toContain('class="cresults"');
    expect(section(html, 'courses')).toContain('href="/study-abroad/uk/universities/university-of-york/courses/university-of-york-ba-history"');
  });

  it('shows an overview typed as plain text under why to study it, not folded away', async () => {
    fixture.overview = 'History asks how we got here and what it meant.';
    const why = section(await render(), 'why');
    expect(why).toContain('<div class="prose fieldwhy__lead"><p class="rich-text" style="white-space:pre-line">History asks how we got here and what it meant.</p></div>');
    expect(why).not.toContain('More about');
  });

  it('opens on why to study it, before its specializations', async () => {
    fixture.overview = '<p>History asks how we got here.</p><p>And what it meant.</p>';
    const html = await render();
    expect(html.indexOf('id="why"')).toBeGreaterThan(html.indexOf('</h1>'));
    expect(html.indexOf('id="why"')).toBeLessThan(html.indexOf('id="specializations"'));
    expect(section(html, 'why')).toContain('Why study Arts, Humanities &amp; Social Sciences in the United Kingdom?');
  });

  it('heads the programme finder visibly, now that it follows the study levels, with the scoped search link', async () => {
    const finder = section(await render(), 'courses');
    expect(finder).toContain('<h2 class="sec-title">Arts, Humanities &amp; Social Sciences programmes in the United Kingdom</h2>');
    expect(finder).not.toContain('<h2 class="sr-only">');
    expect(finder.indexOf('Open in search')).toBeLessThan(finder.indexOf('class="cresults"'));
    expect(finder).toContain('href="/courses?country=uk&amp;subject=arts-humanities-social-sciences#discovery"');
  });

  it('keeps every specialization linked to this subject within this country', async () => {
    const html = await render();
    const directory = section(html, 'specializations');
    for (const entry of specializations) {
      expect(directory).toContain(`href="/study-abroad/uk/${subjectSlug}/${entry.slug}"`);
    }
    expect(directory.match(/<article class="speccard"/g)).toHaveLength(60);
  });

  it('shows nine specialization cards, the ones taught here first, and the rest behind Show all', async () => {
    const directory = section(await render(), 'specializations');
    expect(directory).toContain('id="specialization-list"');
    expect(directory.match(/<article class="speccard" hidden=""/g)).toHaveLength(51);
    expect(directory).toContain('Show all 60 specializations');
    /* The one with a course here leads, and says so in courses. */
    const first = directory.slice(directory.indexOf('<article'), directory.indexOf('</article>'));
    expect(first).toContain('Specialization 1');
    expect(first).toContain('1 course');
  });

  it('keeps the six study levels and the guide link scoped to the country and subject', async () => {
    const html = await render();
    for (const level of levels) expect(html).toContain(`id="level-${level.code.toLowerCase()}"`);
    expect(html).toContain('href="/courses?country=uk&amp;subject=arts-humanities-social-sciences&amp;level=UG&amp;view=guides"');
  });

  it('keeps the empty-country message and all six levels after the specializations', async () => {
    fixture.programmes = 0;
    fixture.guides = 0;
    const html = await render();
    expect(html).not.toContain('id="courses"');
    expect(html).toContain('No Arts, Humanities &amp; Social Sciences course in the United Kingdom is listed on Universta yet.');
    expect(html.indexOf('id="specializations"')).toBeLessThan(html.indexOf('id="programs"'));
    for (const level of levels) expect(html).toContain(`id="level-${level.code.toLowerCase()}"`);
    expect(section(html, 'specializations').match(/<article class="speccard"/g)).toHaveLength(60);
  });
});

describe('the study levels on a country subject page', () => {
  const panel = (html: string, code: string) => {
    const start = html.indexOf(`id="level-${code.toLowerCase()}"`);
    return start < 0 ? '' : html.slice(start, html.indexOf('</section>', start));
  };
  const panelIds = (html: string) =>
    [...html.matchAll(/<section class="coursegroup studylevel[^"]*" id="(level-[^"]+)"/g)].map((m) => m[1]);

  it('shows only the levels ticked on the subject, plus any with a course here', async () => {
    fixture.offered = [byCode('PG'), byCode('PHD')];
    fixture.firstLevels = [byCode('MBA')];
    const html = await render();
    /* The Bachelor's course is listed here, so its level shows too; the
       specialization's MBA does not, since the subject's ticks win. */
    expect(panelIds(html)).toEqual(['level-ug', 'level-pg', 'level-phd']);
  });

  it('with nothing ticked on the subject, shows the levels its specializations are offered at', async () => {
    fixture.guides = 0;
    fixture.firstLevels = [byCode('PG'), byCode('PHD')];
    const html = await render();
    expect(panelIds(html)).toEqual(['level-pg', 'level-phd']);
    expect(section(html, 'programs')).toContain("is offered at Master&#x27;s and PhD.");
  });

  it('shows the six named levels when nothing says what it is offered at, without claiming them', async () => {
    const html = await render();
    expect(panelIds(html)).toHaveLength(6);
    expect(section(html, 'programs')).not.toContain('offered at');
  });

  it('names the specializations offered at each level, linked in this country', async () => {
    fixture.offered = [byCode('UG'), byCode('PG')];
    fixture.firstLevels = [byCode('PG')];
    const html = await render();
    /* Specialization 1 has the Bachelor's course here, and is offered at
       Master's. */
    expect(panel(html, 'UG')).toContain(`href="/study-abroad/uk/${subjectSlug}/specialization-1">Specialization 1<em>1</em></a>`);
    expect(panel(html, 'PG')).toContain(`href="/study-abroad/uk/${subjectSlug}/specialization-1">Specialization 1</a>`);
  });

  it('says an empty level is not listed here yet, once, instead of "0 courses"', async () => {
    fixture.offered = [byCode('UG'), byCode('PHD')];
    const html = await render();
    const phd = panel(html, 'PHD');
    expect(phd).toContain('Not listed in the United Kingdom yet');
    expect(html).not.toContain('0 courses');
    expect(phd).toContain('href="/subjects/arts-humanities-social-sciences/levels/phd"');
    expect(section(html, 'programs')).toContain('PhD has no course listed in the United Kingdom yet.');
    /* The level with a course opens first; the other waits behind its chip. */
    expect(html).toMatch(/<div><section class="coursegroup studylevel scrollstop" id="level-ug"/);
    expect(html).toMatch(/<div hidden=""><section class="coursegroup studylevel scrollstop coursegroup--empty" id="level-phd"/);
  });
});

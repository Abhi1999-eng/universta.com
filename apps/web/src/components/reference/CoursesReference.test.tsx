// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The page sits inside the Study Abroad shell, which supplies the
   assessment through context, and its lists read the router. Both are
   stubbed; the assessment records what opened it. */
const opened: unknown[] = [];
vi.mock('@/components/study-abroad/StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({
    openAssessment: (context: unknown) => opened.push(context),
    openSelector: () => {},
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/courses',
  useSearchParams: () => new URLSearchParams(),
}));

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, CourseFilterOptions, Subject } from '@/lib/catalog';
import { checkGuideFilters, readGuideFilters } from '@/lib/courses-params';
import { readCourseFilters, toProgrammeList } from '@/lib/university-courses';
import { COMPARE_LIMIT } from '@/components/study-abroad/CourseCompare';
import { CoursesReference, type CoursesReferenceProps } from './CoursesReference';

/**
 * /courses as the reference's "Find a Course" in the design's courses-index
 * look: programmes first, the course guides kept as a second view, every
 * block the page had kept after the results, and the course guides' broken
 * parts -- the sheet, the chips, the compare, the eligibility link -- fixed.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const programmeRows = [0, 1, 2].map((index) => ({
  id: `o${index}`,
  name: `MSc Course ${index}`,
  slug: `university-of-warwick-msc-course-${index}`,
  genericCourse: { name: `MSc Course ${index}`, slug: `msc-course-${index}` },
  university: {
    name: 'University of Warwick',
    slug: 'university-of-warwick',
    country: uk,
    campuses: [{ city: 'Coventry' }],
  },
}));

function programmes(raw: Record<string, string> = {}) {
  const filters = readCourseFilters(raw);
  const list = toProgrammeList(
    {
      data: programmeRows,
      meta: { page: 1, limit: 18, total: 3, totalPages: 1 },
      summary: { programmes: 1155, universities: 242, cities: 84, intakeMonths: 3, countries: 20 },
      facets: {
        countries: [
          { value: 'united-kingdom', label: 'United Kingdom', count: 65 },
          { value: 'italy', label: 'Italy', count: 67 },
        ],
        levels: [
          { value: 'UG', label: "Bachelor's", count: 295 },
          { value: 'PG', label: "Master's", count: 506 },
        ],
        subjects: [{ value: 'computer-science', label: 'Computer Science', count: 136 }],
        specializations: [
          { value: 'software-engineering', label: 'Software Engineering', count: 34 },
        ],
        studyModes: [{ value: 'FULL_TIME', label: 'Full time', count: 259 }],
        intakes: [{ value: 'january', label: 'January', startMonth: 1, endMonth: 1, count: 7 }],
      },
    },
    filters,
  );
  return { ...list, filters };
}

const options: CourseFilterOptions = {
  levels: [
    { value: 'UG', label: "Bachelor's", count: 83 },
    { value: 'PG', label: "Master's", count: 100 },
  ],
  countries: Array.from({ length: 12 }, (_, index) => ({
    value: `country-${index}`,
    label: `Country ${index}`,
    count: 20 - index,
    currencyCode: 'EUR',
  })),
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
  englishTests: [{ value: 'IELTS', label: 'IELTS', count: 12 }],
  extras: [{ value: 'scholarshipAvailable', label: 'Scholarships available', count: 11 }],
  sorts: [
    { value: 'featured', label: 'Recommended' },
    { value: 'name', label: 'Alphabetical' },
  ],
  tuition: { enabled: false, country: null, currencyCode: null },
};

const guideCourse = (index: number): Course => ({
  id: `c${index}`,
  name: `BSc Engineering ${index}`,
  slug: `bsc-engineering-${index}`,
  shortName: null,
  qualificationName: 'Bachelor of Science',
  shortDescription: null,
  subject: { id: 's', name: 'Engineering', slug: 'engineering' },
  subSubject: null,
  courseLevel: { id: 'l', name: "Bachelor's", code: 'UG' },
  studyModes: [],
  duration: { min: '3', max: '4', unit: 'YEARS' },
  credits: null,
  featuredMedia: null,
  featured: false,
  availableCountryCount: 5,
  selectedCountry: null,
  selectedTuition: null,
  selectedIntakes: [],
  scholarshipAvailable: null,
  displayOrder: 0,
});

const subject: Subject = {
  id: 's',
  name: 'Computer Science',
  slug: 'computer-science',
  shortDescription: null,
  overview: null,
  iconMedia: null,
  listingMedia: null,
  heroMedia: null,
  featured: false,
  displayOrder: 0,
  publishedCourseCount: 36,
  publishedSubSubjectCount: 12,
  availableCountryCount: 82,
};

function props(over: Partial<CoursesReferenceProps> = {}): CoursesReferenceProps {
  const checked = checkGuideFilters(readGuideFilters({}), options);
  return {
    view: 'programmes',
    programmes: programmes(),
    guides: null,
    guideFilters: checked.filters,
    guideUnknown: checked.unknown,
    guideTotal: 299,
    guideCatalogue: { options, total: 299 },
    subjects: [subject],
    universities: [{ name: 'University of Warwick', slug: 'university-of-warwick' }],
    consultants: [{ name: 'Demo Consultant', slug: 'demo-consultant' }],
    events: [{ name: 'Open day', slug: 'open-day', mode: 'Webinar', startAt: '2026-11-01T00:00:00Z' }],
    heading: 'Find your perfect course',
    lede: 'Search by course.',
    ctaHeading: 'Discover the right course for your future',
    ctaBody: 'Filter the published catalogue.',
    ...over,
  };
}

function guidesView(raw: Record<string, string> = {}, over: Partial<CoursesReferenceProps> = {}) {
  const checked = checkGuideFilters(readGuideFilters(raw), options);
  return props({
    view: 'guides',
    guideFilters: checked.filters,
    guideUnknown: checked.unknown,
    guides: {
      courses: [guideCourse(1), guideCourse(2)],
      meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
      filterOptions: options,
      paged: false,
    },
    ...over,
  });
}

const render = (value: CoursesReferenceProps) =>
  renderToStaticMarkup(<CoursesReference {...value} />);
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  opened.length = 0;
});

describe('/courses, the programme finder', () => {
  it('lists programmes first, each card naming its university and opening its page', () => {
    const page = parse(render(props()));
    const grid = page.querySelector('#discovery [data-testid=course-grid]');
    expect(grid).not.toBeNull();
    const card = grid!.querySelector('.coursecard')!;
    expect(card.querySelector('.coursecard__uni b')?.textContent).toBe('University of Warwick');
    expect(card.querySelector('.coursecard__uni em')?.textContent).toBe('Coventry, United Kingdom');
    const href =
      '/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-course-0';
    expect(card.querySelector('.coursecard__name a')?.getAttribute('href')).toBe(href);
    expect(
      [...card.querySelectorAll('a')].some(
        (link) => link.getAttribute('href') === `${href}#eligibility`,
      ),
    ).toBe(true);
  });

  it('counts the whole catalogue of programmes in the hero, and what it holds in the eyebrow', () => {
    const page = parse(render(props()));
    const stats = [...page.querySelectorAll('.statstrip span')].map((node) => node.textContent);
    expect(stats).toEqual(['Programmes', 'Universities', 'Cities', 'Intake months']);
    expect(page.querySelector('.statstrip b')?.textContent).toBe('1,155');
    const eyebrow = page.querySelector('.hero__eyebrow')?.textContent;
    expect(eyebrow).toContain('20 destinations');
    expect(eyebrow).toContain('1 subject');
    expect(eyebrow).toContain('1 specialisation');
  });

  it('switches between programmes and course guides, each with its count', () => {
    const page = parse(render(props()));
    const programmesTab = page.querySelector('[data-testid=switch-programmes]')!;
    const guidesTab = page.querySelector('[data-testid=switch-guides]')!;
    expect(programmesTab.textContent).toBe('Programmes(3)');
    expect(programmesTab.getAttribute('aria-current')).toBe('page');
    expect(guidesTab.textContent).toBe('Course guides(299)');
    expect(guidesTab.getAttribute('href')).toBe('/courses?view=guides#discovery');
  });

  it('carries the choice in force across to the course guides, in their own names', () => {
    const value = props({
      programmes: programmes({ specialization: 'software-engineering', scholarship: 'true' }),
      guideFilters: checkGuideFilters(
        readGuideFilters({ specialization: 'software-engineering', scholarship: 'true' }),
        options,
      ).filters,
    });
    const page = parse(render(value));
    expect(page.querySelector('[data-testid=switch-guides]')?.getAttribute('href')).toBe(
      '/courses?view=guides&subSubject=software-engineering&scholarshipAvailable=true#discovery',
    );
  });

  it('hides the switcher and opens on the course guides when the catalogue has no programme', () => {
    const page = parse(render(guidesView({}, { programmes: null })));
    expect(page.querySelector('.cf-switch')).toBeNull();
    expect(page.querySelector('[data-testid=course-guide-grid]')).not.toBeNull();
    const stats = [...page.querySelectorAll('.statstrip span')].map((node) => node.textContent);
    expect(stats).toEqual(['Courses', 'Destinations', 'Subjects', 'Specialisations']);
    /* Without programmes the guides are the page, so their own address
       does not name a view. */
    expect(page.querySelector('input[name=view]')).toBeNull();
  });

  it('keeps every block the page had, after the results and in order', () => {
    const html = render(props());
    const results = html.indexOf('id="discovery"');
    const headings = [
      'Not sure what to search for?',
      'Key takeaways',
      'Browse courses by subject',
      'Browse courses by degree level',
      'Browse courses by study destination',
      'Explore by specialisation',
      'Courses by study mode',
      'Courses by intake',
      'Everything you need to choose with confidence',
      'Study abroad tools',
      'Upcoming events',
      'How to choose the right study abroad course',
      'Frequently asked questions',
      'Explore universities',
      'Explore destinations',
      'Find a consultant',
      'Discover the right course for your future',
      'Related on Universta',
      'Not sure which country is right for you?',
    ];
    let previous = results;
    for (const heading of headings) {
      const at = html.indexOf(heading);
      expect(at, heading).toBeGreaterThan(previous);
      previous = at;
    }
    expect(html.indexOf('id="plan"')).toBeGreaterThan(html.indexOf('Related on Universta'));
  });

  it('draws none of those blocks in the class names the stylesheet never had', () => {
    const html = render(props());
    for (const unstyled of [
      'class="panel"',
      'grid g4',
      'subj-card',
      'mini-card',
      'dest-card',
      'card benefit',
      'card tool',
      'card event',
      'class="takeaways"',
      'class="qa"',
      'link-cols',
      'final-cta',
      'link-more',
    ])
      expect(html, unstyled).not.toContain(unstyled);
  });

  it('counts what each block opens: programmes on the programmes view, guides on the guides view', () => {
    const programmesPage = parse(render(props()));
    const level = programmesPage.querySelector('#levels .h-card')!;
    expect(level.getAttribute('href')).toBe('/courses?level=UG#discovery');
    expect(level.textContent).toContain('295 programmes');

    const guidesPage = parse(render(guidesView()));
    const guideLevel = guidesPage.querySelector('#levels .h-card')!;
    expect(guideLevel.getAttribute('href')).toBe('/courses?view=guides&level=UG#discovery');
    expect(guideLevel.textContent).toContain('83 courses');
  });

  it('opens the assessment from the matching band, with its small print', () => {
    const page = parse(render(props()));
    const band = page.querySelector('#find-programs')!;
    const button = band.querySelector('button[data-open-assessment]')!;
    expect(button.getAttribute('data-intent')).toBe('courses-index');
    expect(band.querySelector('.matchband__note')?.textContent).toContain(
      'does not guarantee admission',
    );
    expect(band.querySelector('a[href="/contact"]')).not.toBeNull();
  });

  it('states the shortlist’s limit from the compare store', () => {
    const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
    const html = render(props());
    expect(html).toContain(`Compare up to ${words[COMPARE_LIMIT]} programmes side by side`);
    expect(html).toContain(`Shortlist up to ${words[COMPARE_LIMIT]} programmes`);
    expect(html).toContain(`Line up to ${words[COMPARE_LIMIT]} programmes side by side.`);
  });

  it('offers the assessment and the course guides when no programme matches', () => {
    const empty = props({
      programmes: {
        ...programmes({ country: 'atlantis' }),
        cards: [],
        meta: { page: 1, limit: 18, total: 0, totalPages: 0 },
      },
      guideTotal: 0,
    });
    const page = parse(render(empty));
    const none = page.querySelector('[data-testid=course-empty]')!;
    expect(none.querySelector('button[data-open-assessment]')).not.toBeNull();
    expect(none.querySelector('a.linkcta')?.getAttribute('href')).toBe(
      '/courses?view=guides#discovery',
    );
    const chip = page.querySelector('.activechip')!;
    expect(chip.textContent).toContain('atlantis');
    expect(chip.getAttribute('rel')).toBe('nofollow');
  });
});

describe('/courses?view=guides, the course guides', () => {
  it('makes the filter form the panel’s own scrolling body, with Apply at its foot', () => {
    const page = parse(render(guidesView()));
    const panel = page.querySelector('aside.filters-panel')!;
    const form = page.querySelector('form#course-guide-filters')!;
    expect(form.parentElement).toBe(panel);
    expect(form.classList.contains('filters-panel__body')).toBe(true);
    const foot = panel.querySelector(':scope > .filters-panel__foot')!;
    expect(foot.querySelector('button')?.getAttribute('form')).toBe('course-guide-filters');
    expect(form.contains(foot)).toBe(false);
  });

  it('shows a long group’s first eight with its own search, and keeps a value in force in view', () => {
    const page = parse(render(guidesView({ country: 'country-11' })));
    const group = page.querySelector('[aria-labelledby=guide-filter-country]')!;
    expect(group.querySelector('.fsearch')).not.toBeNull();
    const first = group.querySelector(':scope > .fgroup__opts')!;
    const ticked = first.querySelector('input[value=country-11]') as HTMLInputElement;
    expect(ticked.checked).toBe(true);
    expect(group.querySelector('.fgroup__all')?.textContent).toContain('Show all 12');
  });

  it('chips what is in force, each removing one value and kept out of the index', () => {
    const page = parse(render(guidesView({ country: 'country-1,atlantis', q: 'data' })));
    const chips = [...page.querySelectorAll('.activechip')];
    expect(chips.map((chip) => chip.textContent?.replace('×', '').trim())).toEqual([
      '“data”',
      'Country 1',
      'atlantis',
    ]);
    expect(chips.every((chip) => chip.getAttribute('rel') === 'nofollow')).toBe(true);
    expect(chips[2]!.getAttribute('href')).toBe(
      '/courses?view=guides&q=data&country=country-1#discovery',
    );
    expect(page.querySelector('[data-testid=course-count]')?.textContent).toBe(
      '2 courses match your filters',
    );
  });

  it('counts a plain search as narrowing the list', () => {
    const page = parse(render(guidesView({ q: 'data' })));
    expect(page.querySelector('[data-testid=course-count]')?.textContent).toBe(
      '2 courses match your search',
    );
  });

  it('opens the assessment from a card’s Check eligibility rather than a counselling form', () => {
    const html = render(guidesView());
    const grid = parse(html).querySelector('[data-testid=course-guide-grid]')!;
    expect(grid.querySelector('a[href="/counselling"]')).toBeNull();

    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<CoursesReference {...guidesView()} />));
    const button = host.querySelector('[data-testid=guide-eligibility]') as HTMLButtonElement;
    act(() => button.click());
    expect(opened).toEqual([
      { intent: 'course-guide-card', sourcePagePath: '/courses/bsc-engineering-1' },
    ]);
  });

  it('links a guide to the programmes that teach it, in place of a compare that never worked', () => {
    const grid = parse(render(guidesView())).querySelector('[data-testid=course-guide-grid]')!;
    expect(grid.querySelector('.tinycheck')).toBeNull();
    expect(grid.querySelector('.coursecard__compare')?.getAttribute('href')).toBe(
      '/courses?course=bsc-engineering-1#discovery',
    );
    const withoutProgrammes = parse(render(guidesView({}, { programmes: null })));
    expect(withoutProgrammes.querySelector('.coursecard__compare')).toBeNull();
  });
});

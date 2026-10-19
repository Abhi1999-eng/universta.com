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
import { toStripEvent } from '@/lib/course-events';
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

  it('counts the whole catalogue of programmes in the hero, with no count line over it', () => {
    const page = parse(render(props()));
    const stats = [...page.querySelectorAll('.statstrip span')].map((node) => node.textContent);
    expect(stats).toEqual(['Programmes', 'Universities', 'Cities', 'Intake months']);
    expect(page.querySelector('.statstrip b')?.textContent).toBe('1,155');
    expect(page.querySelector('.hero__eyebrow')).toBeNull();
  });

  it('keeps the quick filters under the hero, with no "Try" row of example searches', () => {
    const page = parse(render(props()));
    const row = page.querySelector('.hero .bigsearch__ex')!;
    expect(row.querySelector('.label')).toBeNull();
    expect(row.querySelectorAll('a')).toHaveLength(0);
    expect([...row.querySelectorAll('button')].map((node) => node.textContent)).toEqual([
      'Scholarships',
      'Post-study work',
    ]);
  });

  /* The first chip on the page opened "0 programmes of 4". It stays, and
     is inactive while nothing is behind it; on, it can always be undone. */
  it('draws a quick filter inactive while it would open nothing, and live otherwise', () => {
    const chips = (value: CoursesReferenceProps) =>
      [...parse(render(value)).querySelectorAll('.hero .bigsearch__ex button')].map((node) => ({
        label: node.textContent,
        disabled: node.hasAttribute('disabled'),
        title: node.getAttribute('title'),
      }));
    const none = chips(props());
    expect(none.map((chip) => chip.label)).toEqual(['Scholarships', 'Post-study work']);
    expect(none[0]).toEqual({
      label: 'Scholarships',
      disabled: true,
      title: 'No programme lists a scholarship yet',
    });

    const funded = programmes();
    funded.facets = {
      ...funded.facets,
      extras: [
        { value: 'scholarship', label: 'With scholarships', count: 3 },
        { value: 'postStudyWork', label: 'Post-study work', count: 2 },
      ],
    };
    expect(chips(props({ programmes: funded })).map((chip) => chip.disabled)).toEqual([false, false]);

    /* On, with nothing behind it, it stays live so it can be turned off. */
    const on = programmes({ scholarship: 'true' });
    expect(chips(props({ programmes: on }))[0]!.disabled).toBe(false);

    /* The guides count their own tick. */
    expect(chips(guidesView())[0]!.disabled).toBe(false);
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
    /* One subject and one specialization in the fixture, named so. */
    expect(stats).toEqual(['Courses', 'Destinations', 'Subject', 'Specialization']);
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
      'Explore by specialization',
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
    expect(chip.textContent).toContain('Atlantis');
    expect(chip.getAttribute('rel')).toBe('nofollow');
  });

  /* An empty programme list with the given filters, and the course
     guides' count for the filters they can apply. */
  const emptyFor = (raw: Record<string, string>, guideTotal: number) => {
    const list = programmes(raw);
    return props({
      programmes: { ...list, cards: [], meta: { page: 1, limit: 18, total: 0, totalPages: 0 } },
      guideFilters: checkGuideFilters(readGuideFilters(raw), options).filters,
      guideTotal,
    });
  };
  const guidesLink = (value: CoursesReferenceProps) =>
    parse(render(value)).querySelector('[data-testid=course-empty] a.linkcta')!;

  it('says how many course guides match when the guides can apply every filter', () => {
    const link = guidesLink(emptyFor({ level: 'PG', country: 'country-1' }, 14));
    expect(link.textContent).toContain('14 course guides match these filters');
    expect(link.getAttribute('href')).toBe(
      '/courses?view=guides&level=PG&country=country-1#discovery',
    );
  });

  it('claims no match for the guides when a filter they cannot apply is in force', () => {
    const extras: Array<Record<string, string>> = [
      { university: 'university-of-warwick' },
      { city: 'coventry' },
      { status: 'closed' },
      { ielts: '6' },
      { duration: 'up-to-1-year' },
    ];
    for (const extra of extras) {
      const link = guidesLink(emptyFor({ level: 'PG', ...extra }, 23));
      expect(link.textContent, JSON.stringify(extra)).not.toContain('match');
      expect(link.textContent).toContain('Browse the course guides');
      /* The guides open on what they can apply, and carry the rest. */
      const href = link.getAttribute('href')!;
      expect(href).toContain('view=guides&level=PG');
      expect(href).toContain(new URLSearchParams(extra).toString());
    }
  });

  it('points a list narrowed to one course at that course’s own guide', () => {
    const value = emptyFor({ course: 'ba-law-15' }, 299);
    value.programmes!.facets = {
      ...value.programmes!.facets,
      course: [{ value: 'ba-law-15', label: 'BA Law', count: 0 }],
    };
    const page = parse(render(value));
    const link = page.querySelector('[data-testid=course-empty] a.linkcta')!;
    expect(link.getAttribute('href')).toBe('/courses/ba-law-15');
    expect(link.textContent).toContain('Read the BA Law course guide');
    expect(page.querySelector('.activechip')?.textContent).toContain('BA Law');

    /* A course nothing names may be no guide at all, so it is not linked. */
    const unknown = guidesLink(emptyFor({ course: 'no-such-course' }, 299));
    expect(unknown.getAttribute('href')).not.toContain('/courses/no-such-course');
    expect(unknown.textContent).toContain('Browse the course guides');
  });

  it('suggests programmes, codes and universities as the reader types in the finder', () => {
    const field = parse(render(props())).querySelector('#discovery input[role=combobox]');
    expect(field?.getAttribute('aria-label')).toBe('Search programmes');
  });
});

describe('/courses, the bands under the list', () => {
  const named = (name: string, publishedCourseCount: number): Subject => ({
    ...subject,
    id: name,
    name,
    slug: name.toLowerCase().replace(/\W+/g, '-'),
    publishedCourseCount,
  });

  it('browses only subjects with published courses, the busiest first', () => {
    const subjects = [
      named('QA Delete Test', 0),
      named('Browser Country E2E Subject', 0),
      named('Law', 2),
      named('Computer Science', 9),
      named('Engineering', 5),
    ];
    const page = parse(render(props({ subjects })));
    const browse = [...page.querySelectorAll('#subjects .subjcard__name a')].map(
      (node) => node.textContent,
    );
    expect(browse).toEqual(['Computer Science', 'Engineering', 'Law']);
    /* The "Related on Universta" subjects follow the same rule. */
    const related = [...page.querySelectorAll('#connect .h-relgroup')].find((group) =>
      group.querySelector('.h-relgroup__t')?.textContent?.startsWith('Subjects'),
    );
    expect([...related!.querySelectorAll('li a')].map((node) => node.textContent)).toEqual([
      'Computer Science',
      'Engineering',
      'Law',
    ]);
  });

  it('hides the subject band when no subject has a published course', () => {
    const page = parse(render(props({ subjects: [named('QA Delete Test', 0)] })));
    expect(page.querySelector('#subjects')).toBeNull();
    expect(page.body.textContent).not.toContain('QA Delete Test');
  });

  it('sends "All destinations" to the destinations, not the home page', () => {
    const page = parse(render(props()));
    const link = [...page.querySelectorAll('#destinations a.linkcta')].find((node) =>
      node.textContent?.includes('All destinations'),
    );
    expect(link?.getAttribute('href')).toBe('/study-abroad');
  });

  it('names a figure of one in the singular in the hero', () => {
    const one = programmes();
    const page = parse(
      render(
        props({
          programmes: {
            ...one,
            summary: { programmes: 4, universities: 1, cities: 1, intakeMonths: 1, countries: 1 },
          },
        }),
      ),
    );
    expect([...page.querySelectorAll('.statstrip span')].map((node) => node.textContent)).toEqual([
      'Programmes',
      'University',
      'City',
      'Intake month',
    ]);

    const guides = parse(
      render(
        guidesView(
          {},
          {
            programmes: null,
            guideCatalogue: {
              options: {
                ...options,
                countries: options.countries.slice(0, 1),
                subjects: options.subjects.slice(0, 1),
              },
              total: 1,
            },
          },
        ),
      ),
    );
    expect([...guides.querySelectorAll('.statstrip span')].map((node) => node.textContent)).toEqual([
      'Course',
      'Destination',
      'Subject',
      'Specialization',
    ]);
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
    const taught = guidesView();
    taught.guides!.taught = ['bsc-engineering-1'];
    const grid = parse(render(taught)).querySelector('[data-testid=course-guide-grid]')!;
    expect(grid.querySelector('.tinycheck')).toBeNull();
    const links = [...grid.querySelectorAll('.coursecard__compare')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/courses?course=bsc-engineering-1#discovery',
    ]);
    /* A guide no live programme teaches would open an empty list, so its
       card has no such link. */
    const second = grid.querySelectorAll('.coursecard')[1]!;
    expect(second.querySelector('.coursecard__compare')).toBeNull();
    expect(parse(render(guidesView())).querySelector('.coursecard__compare')).toBeNull();
    const withoutProgrammes = parse(render(guidesView({}, { programmes: null })));
    expect(withoutProgrammes.querySelector('.coursecard__compare')).toBeNull();
  });

  it('carries the programmes’ own filters unapplied, so the way back finds them', () => {
    const raw = { view: 'guides', level: 'PG', university: 'university-of-warwick' };
    const page = parse(render(guidesView(raw, { programmes: programmes(raw) })));
    expect(page.querySelector('[data-testid=switch-programmes]')?.getAttribute('href')).toBe(
      '/courses?university=university-of-warwick&level=PG#discovery',
    );
    /* Not applied to the guides, so not chipped as if it were. */
    const chips = [...page.querySelectorAll('.activechip')].map((chip) => chip.textContent);
    expect(chips.join(' ')).not.toContain('warwick');
    /* Every way the guides move on keeps it: a chip, a filter submitted
       without script. */
    expect(page.querySelector('.activechip')?.getAttribute('href')).toBe(
      '/courses?view=guides&university=university-of-warwick#discovery',
    );
    expect(
      page.querySelector('#course-guide-filters input[type=hidden][name=university]')?.getAttribute('value'),
    ).toBe('university-of-warwick');
  });
});

/**
 * The "Upcoming events" strip, as the zip's scholarship card: format badge,
 * Date, Time with its zone, Format, Where, and "View event", each date in
 * the event's own zone rather than UTC. The card is an <article> whose
 * title link covers it; Register is a link of its own beside it.
 */
describe('the upcoming events strip', () => {
  const event = toStripEvent(
    {
      title: 'Study in Japan evening',
      slug: 'study-in-japan-evening',
      eventType: 'WEBINAR',
      /* 16:00 UTC on the 25th is 01:00 on the 26th in Tokyo. */
      startsAt: '2026-10-25T16:00:00.000Z',
      endsAt: '2026-10-25T18:00:00.000Z',
      timezone: 'Asia/Tokyo',
      venue: 'Shibuya Hall',
      city: { name: 'Tokyo' },
      country: { name: 'Japan', slug: 'japan', iso2Code: 'jp' },
      registrationUrl: 'https://example.invalid/register',
    },
    Date.parse('2026-10-01T00:00:00Z'),
  );
  const strip = (html: string) =>
    html.slice(html.indexOf('id="events"'), html.indexOf('id="how-to-choose"'));

  it('dates each event in its own zone, with the time and the zone’s name', () => {
    const html = strip(render(props({ events: [event] })));
    expect(html).toContain('26 Oct 2026');
    expect(html).not.toContain('25 Oct 2026');
    expect(html).toContain('<dt>Time</dt><dd>1:00 am JST</dd>');
  });

  it('draws the zip’s card: badge, facts and the ways in, with no link inside a link', () => {
    const html = strip(render(props({ events: [event] })));
    expect(html).toContain('<article class="schcard cg-eventcard">');
    expect(html).toContain('<span class="fundbadge">Webinar</span>');
    for (const label of ['Date', 'Time', 'Format', 'Where']) expect(html).toContain(`<dt>${label}</dt>`);
    expect(html).toContain('Shibuya Hall, Tokyo');
    expect(html).toContain('<span class="flagchip__code">JP</span>Japan');
    expect(html).toContain('href="/events/study-in-japan-evening"');
    expect(html).toContain('View event');
    expect(html).toContain('href="https://example.invalid/register"');
    const doc = parse(html);
    expect(doc.querySelectorAll('a a')).toHaveLength(0);
  });

  it('offers Register only until the event has ended', () => {
    const over = toStripEvent(
      {
        title: 'Past evening',
        slug: 'past',
        startsAt: '2026-01-01T10:00:00Z',
        registrationUrl: 'https://example.invalid/register',
      },
      Date.parse('2026-10-01T00:00:00Z'),
    );
    expect(strip(render(props({ events: [over] })))).not.toContain('Register');
  });

  it('still prints a date for an event passed in the old shape', () => {
    expect(strip(render(props()))).toContain('1 Nov 2026');
  });
});

/** "How to choose" sets its prose beside its heading, not under it. */
describe('how to choose a course', () => {
  it('puts the prose and its Read more in the right-hand column of the split head', () => {
    const html = render(props());
    const band = html.slice(html.indexOf('id="how-to-choose"'), html.indexOf('id="faq"'));
    expect(band).toMatch(/sec-head--split[\s\S]*sec-head__aside[\s\S]*<\/div><div><div class="prose">/);
    expect(band).toContain('Read more about course selection');
  });
});

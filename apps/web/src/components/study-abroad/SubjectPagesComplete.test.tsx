import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SubjectDetail } from '@/lib/catalog';
import type { ScholarshipCard } from '@/lib/scholarship-card';
import { everyLevel, subjectOfferedLevels } from '@/lib/course-levels';
import { toOfferingCard } from '@/lib/university-courses';

const searchParams = { current: new URLSearchParams() };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => searchParams.current,
}));
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: vi.fn(), openMatch: vi.fn() }),
}));

const { SubjectGuide } = await import('./SubjectGuide');
const { SpecializationGuide } = await import('./SpecializationGuide');
const { SubjectIndex } = await import('./SubjectIndex');
const { SpecializationsReference } = await import(
  '@/components/reference/SpecializationsReference'
);

/**
 * The subject and specialization pages outside a country, as the
 * completeness audit found them and as they should read now: destinations
 * that open on the places that teach it with true figures, the overview on
 * the page, links that hand on to the specialization rather than to a search,
 * and levels in the order a student climbs them.
 */

/** Where each destination chip goes, in the order they are drawn. Only the
 *  destination band's chips: a related subject is a chip too, but it opens
 *  a subject, not a place. */
const chipHrefs = (html: string) =>
  [...html.matchAll(/<a [^>]*class="switcher__item"[^>]*>/g)]
    .map((match) => match[0].match(/href="([^"]+)"/)?.[1] ?? '')
    .filter((href) => href.startsWith('/study-abroad/'));

const level = (code: string, name: string) => ({ id: code.toLowerCase(), code, name });
const UG = level('UG', "Bachelor's");
const PG = level('PG', "Master's");
const PHD = level('PHD', 'PhD');
const DIPLOMA = level('DIPLOMA', 'Diploma');

const destinations = [
  { id: 'us', name: 'United States', slug: 'united-states', iso2Code: 'US', courseCount: 6 },
  { id: 'gb', name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB', courseCount: 6 },
  { id: 'ca', name: 'Canada', slug: 'canada', iso2Code: 'CA', courseCount: 5 },
  { id: 'af', name: 'Afghanistan', slug: 'afghanistan', iso2Code: 'AF', courseCount: 0 },
];

const subject = {
  id: 'cs',
  name: 'Computer Science',
  slug: 'computer-science',
  shortDescription: 'Computation, in theory and practice.',
  overview:
    '<p>Computer science is the study of computation itself. It asks what can be computed and how well.</p><h3>What you study</h3><p>Algorithms and systems.</p>',
  iconMedia: null,
  publishedCourseCount: 36,
  availableCountryCount: 3,
  subSubjects: [
    {
      id: 'se',
      name: 'Software Engineering',
      slug: 'software-engineering',
      shortDescription: 'Building software that lasts.',
      publishedCourseCount: 6,
      /* In the order the database grouped them. */
      levels: [PHD, DIPLOMA, UG],
    },
  ],
  countries: destinations,
  tests: [],
  courseCountsByLevel: [
    { level: DIPLOMA, count: 3 },
    { level: UG, count: 9 },
    { level: PG, count: 14 },
    { level: PHD, count: 3 },
  ],
  featuredCourses: [],
  seo: null,
} as unknown as SubjectDetail;

describe('a subject’s page', () => {
  const html = renderToStaticMarkup(
    <SubjectGuide
      subject={subject}
      scholarships={[]}
      universities={[{ id: 'u1', name: 'Lakeside', slug: 'lakeside' }]}
      universityTotal={105}
      related={[
        { id: 'ds', name: 'Data Science', slug: 'data-science' },
        { id: 'eng', name: 'Engineering', slug: 'engineering' },
      ]}
    />,
  );

  it('opens its destinations on the places that teach it, each with its count', () => {
    const chips = chipHrefs(html);
    expect(chips.slice(0, 3)).toEqual([
      '/study-abroad/united-states/computer-science',
      '/study-abroad/united-kingdom/computer-science',
      '/study-abroad/canada/computer-science',
    ]);
    expect(html).toContain('<span class="dir__meta" aria-hidden="true">6</span>');
  });

  it('states the true figures: destinations that teach it, every university', () => {
    expect(html).toMatch(/<p class="subjabout__facts datum">.* 3 destinations<\/p>/);
    expect(html).toContain('3 destinations teach Computer Science');
    expect(html).toMatch(/Universities <span class="h-count__n">105<\/span>/);
  });

  /* The client had the count line over the heading and the facts box
     under the hero -- specializations, study levels and the rest --
     taken off the page. */
  it('opens on its name, with no count line above it and no facts box below', () => {
    expect(html).toContain('<div><h1 class="hero__h1">Study Computer Science abroad</h1>');
    expect(html).not.toContain('hero__eyebrow');
    expect(html).not.toContain('unisnap');
    expect(html).not.toMatch(/<span class="label">(?:Specializations|Study levels)<\/span>/);
  });

  it('shows the overview’s opening on the page, the rest under the toggle', () => {
    expect(html).toContain(
      '<p class="ov__lead">Computer science is the study of computation itself.</p>',
    );
    expect(html).toContain('<p class="ov__more">It asks what can be computed and how well.</p>');
    expect(html).toContain('More about Computer Science');
    expect(html).toContain('Algorithms and systems.');
  });

  it('does not open the overview on the sentence the hero has just printed', () => {
    const repeated = renderToStaticMarkup(
      <SubjectGuide
        subject={
          {
            ...subject,
            shortDescription: 'Computer science is the study of computation itself.',
          } as SubjectDetail
        }
        scholarships={[]}
        universities={[]}
        universityTotal={0}
        related={[]}
      />,
    );
    expect(repeated.match(/Computer science is the study of computation itself\./g)).toHaveLength(1);
    expect(repeated).toContain('<p class="ov__lead">It asks what can be computed and how well.</p>');
  });

  it('lists the specialization’s levels in climbing order', () => {
    expect(html).toContain('Diploma, Bachelor&#x27;s, PhD');
  });

  it('closes with its related subjects, and a way to all of them', () => {
    expect(html).toMatch(/<h2 class="sec-title sec-title--sm">Related subjects<\/h2>/);
    expect(html).toContain('href="/subjects/data-science"');
    expect(html).toMatch(/<a class="linkcta" href="\/subjects">All subjects/);
  });

  it('sends its connect band’s destinations to the subject in that country', () => {
    expect(html).toContain(
      '<a href="/study-abroad/united-states/computer-science">United States</a><span>6 programmes</span>',
    );
    expect(html).not.toContain('href="/study-abroad/afghanistan"');
  });

  it('hands an enquiry over with the subject it was about', () => {
    expect(html).toContain(
      'href="/counselling?source=subject&amp;subject=computer-science&amp;from=%2Fsubjects%2Fcomputer-science"',
    );
  });

  it('leaves the related band out when no subject shares a specialization', () => {
    const alone = renderToStaticMarkup(<SubjectGuide subject={subject} scholarships={[]} />);
    expect(alone).not.toContain('Related subjects');
  });

  it('sends "Every Computer Science programme" to the course guides its count is of', () => {
    const levelled = renderToStaticMarkup(
      <SubjectGuide
        subject={subject}
        scholarships={[]}
        levels={[{ level: PG, count: 14, courses: [] } as never]}
      />,
    );
    expect(levelled).toContain('14 programmes, each under the level it is taught at.');
    expect(levelled).toMatch(
      /href="\/courses\?subject=computer-science&amp;view=guides">Every Computer Science programme/,
    );
    expect(levelled).toContain('href="/subjects/computer-science/masters?view=guides"');
  });
});

/**
 * The reference's subject page shows programmes -- a course as one
 * university teaches it -- and a "View all" into the finder; ours listed
 * only the catalogue's course guides. The programmes now lead, each card
 * naming its university and opening its own page, and the course guides
 * keep their levels below, called courses so the two counts are not
 * mistaken for each other.
 */
describe('programmes on a subject’s and a specialization’s page', () => {
  const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
  const programme = (slug: string, university: string) =>
    toOfferingCard({
      id: slug,
      slug,
      name: 'MSc Computer Science',
      genericCourse: {
        name: 'MSc Computer Science',
        slug: 'msc-computer-science',
        courseLevel: { code: 'PG', name: "Master's" },
      },
      university: {
        name: university,
        slug: university.toLowerCase().replace(/\s+/g, '-'),
        country: uk,
        campuses: [{ city: 'Coventry' }],
      },
    })!;
  const sample = {
    cards: [
      programme('university-of-warwick-msc-computer-science', 'University of Warwick'),
      programme('university-of-oxford-msc-computer-science', 'University of Oxford'),
    ],
    total: 136,
    universities: 105,
    cities: 38,
  };
  const levelled = [{ level: PG, count: 14, courses: [] } as never];

  it('draws the programmes as cards, each opening its own page', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject} scholarships={[]} levels={levelled} programmes={sample} />,
    );
    expect(html).toContain('id="courses"');
    expect(html).toContain('Where to study Computer Science');
    expect(html.match(/class="coursecard"/g)).toHaveLength(2);
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-of-warwick/courses/university-of-warwick-msc-computer-science"',
    );
    expect(html).toContain('136 programmes at 105 universities');
  });

  it('opens all of them in the finder, with the count the finder will show', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject} scholarships={[]} levels={levelled} programmes={sample} />,
    );
    expect(html).toMatch(/<a class="linkcta" href="\/courses\?subject=computer-science">View all 136 programmes/);
  });

  it('keeps the levels, called courses beside the programmes, with their links on the course guides', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject} scholarships={[]} levels={levelled} programmes={sample} />,
    );
    expect(html).toContain('Computer Science courses by level');
    expect(html).toContain('14 courses, each under the level it is taught at.');
    expect(html).toContain('href="/subjects/computer-science/masters?view=guides"');
  });

  it('stands the section down, and keeps the old names, with no programme listed', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject} scholarships={[]} levels={levelled} programmes={null} />,
    );
    expect(html).not.toContain('id="courses"');
    expect(html).not.toContain('class="coursecard"');
    expect(html).toContain('Computer Science programmes by level');
    /* Every other count keeps the name it always had, too. */
    expect(html).toMatch(/<p class="subjabout__facts datum">36 programmes ·.* 3 destinations<\/p>/);
    expect(html).toContain('<span class="speccard__count datum">6 programmes</span>');
    expect(html).toContain('aria-label="Computer Science in United Kingdom, 6 programmes"');
    expect(html).toContain('<a href="/study-abroad/united-states/computer-science">United States</a><span>6 programmes</span>');
  });

  /* Beside the programmes, a chip saying "6 programmes" opened a page
     listing 15, and a card saying "6 programmes" opened one listing 34:
     those counts are of the catalogue's courses, and are called that. */
  it('calls the course counts courses beside the programmes, so they match the pages they open', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide subject={subject} scholarships={[]} levels={levelled} programmes={sample} />,
    );
    const specs = html.slice(html.indexOf('id="specializations"'), html.indexOf('id="destinations"'));
    expect(specs).toContain('<span class="speccard__count datum">6 courses</span>');
    expect(specs).not.toContain('programmes');
    expect(html).toContain('aria-label="Computer Science in United Kingdom, 6 courses"');
    expect(html).toContain('<a href="/study-abroad/united-states/computer-science">United States</a><span>6 courses</span>');
    /* The facts line is all one kind of count: the destinations are the
       ones its courses are taught in, so the first figure is its courses. */
    expect(html).toMatch(/<p class="subjabout__facts datum">36 courses ·.* 3 destinations<\/p>/);
    expect(html).not.toContain('136 programmes ·');
  });

  it('calls a specialization’s related and destination counts courses beside its programmes', () => {
    const render = (programmes: typeof sample | null) =>
      renderToStaticMarkup(
        <SpecializationGuide
          specialization={specialization as never}
          scholarships={[]}
          levels={levelled}
          programmes={programmes}
        />,
      );
    const listed = render({ ...sample, total: 34, universities: 32 });
    expect(listed).toContain('<span class="speccard__count datum">4 courses</span>');
    expect(listed).toContain('aria-label="Software Engineering in Canada, 3 courses"');
    expect(listed).toContain('Software Engineering in Canada</a><span>3 courses</span>');
    const none = render(null);
    expect(none).toContain('<span class="speccard__count datum">4 programmes</span>');
    expect(none).toContain('aria-label="Software Engineering in Canada, 3 programmes"');
    expect(none).toContain('Software Engineering in Canada</a><span>3 programmes</span>');
  });

  it('shows a specialization’s programmes and opens all of them with both halves of the pair', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide
        specialization={specialization as never}
        scholarships={[]}
        levels={levelled}
        programmes={{ ...sample, total: 34, universities: 32 }}
      />,
    );
    expect(html).toContain('Where to study Software Engineering');
    expect(html.match(/class="coursecard"/g)).toHaveLength(2);
    expect(html).toMatch(
      /<a class="linkcta" href="\/courses\?subject=computer-science&amp;specialization=software-engineering">View all 34 programmes/,
    );
    expect(html).toContain('Software Engineering courses by level');
  });
});

const specialization = {
  id: 'se',
  name: 'Software Engineering',
  slug: 'software-engineering',
  shortDescription: null,
  overview: null,
  subject: { id: 'cs', name: 'Computer Science', slug: 'computer-science', shortDescription: null },
  siblings: [
    {
      id: 'ai',
      name: 'Artificial Intelligence',
      slug: 'artificial-intelligence',
      shortDescription: 'Machines that reason.',
      publishedCourseCount: 4,
      levels: [UG, PG, PHD],
    },
  ],
  siblingTotal: 11,
  countries: [
    { id: 'af', name: 'Afghanistan', slug: 'afghanistan', iso2Code: 'AF', courseCount: 0 },
    { id: 'gb', name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB', courseCount: 2 },
    { id: 'ca', name: 'Canada', slug: 'canada', iso2Code: 'CA', courseCount: 3 },
  ],
  availableCountryCount: 2,
  courses: [],
  universities: {
    total: 32,
    data: [
      { id: 'u1', name: 'Lakeside', slug: 'lakeside', country: { name: 'United States', slug: 'united-states' } },
    ],
  },
};

const scholarship: ScholarshipCard = {
  id: 'sch-1',
  title: 'Global Merit Award',
  slug: 'global-merit-award',
  summary: null,
  provider: null,
  benefit: null,
  award: null,
  deadline: null,
  eligibility: null,
  countries: [],
  universities: [],
};

describe('a specialization’s page', () => {
  const render = (scholarships: ScholarshipCard[] = []) =>
    renderToStaticMarkup(
      <SpecializationGuide
        specialization={specialization as never}
        scholarships={scholarships}
        levels={[
          {
            level: { id: 'ug', code: 'UG', name: "Bachelor's" },
            count: 6,
            courses: [],
          } as never,
        ]}
      />,
    );
  const html = render();

  it('opens its destinations on the places that teach it', () => {
    const chips = chipHrefs(html);
    expect(chips).toEqual([
      '/study-abroad/canada/computer-science/software-engineering',
      '/study-abroad/united-kingdom/computer-science/software-engineering',
      '/study-abroad/afghanistan/computer-science/software-engineering',
    ]);
  });

  it('opens this specialization’s courses, not the whole subject’s', () => {
    const own = '/courses?subject=computer-science&amp;specialization=software-engineering';
    /* The hero, the match band and the connect band print no count, so
       they open its programmes. */
    expect(html.split(`href="${own}"`).length - 1).toBe(3);
    /* "View all 6" counts courses, so it opens the course guides, which
       list six. */
    expect(html).toMatch(
      new RegExp(`href="${own.replace(/[?]/g, '\\?')}&amp;view=guides">View all 6 Software Engineering programmes`),
    );
    expect(html).toMatch(/href="\/courses\?subject=computer-science">Every Computer Science programme/);
  });

  it('opens each level’s count on the course guides', () => {
    expect(html).toContain(
      'href="/subjects/computer-science/software-engineering/bachelors?view=guides"',
    );
  });

  it('names its destinations as the design does, each opening it there', () => {
    expect(html).toContain(
      '<a href="/study-abroad/canada/computer-science/software-engineering">Software Engineering in Canada</a>',
    );
    expect(html).toContain('Software Engineering in the United Kingdom');
  });

  it('names the universities that teach it, with how many in all', () => {
    expect(html).toMatch(/Universities teaching Software Engineering <span class="h-count__n">32<\/span>/);
    expect(html).toContain('<a href="/universities/lakeside">Lakeside</a><span>United States</span>');
  });

  it('fills each related card: a line, its levels, its programmes', () => {
    expect(html).toContain('<span class="speccard__desc">Machines that reason.</span>');
    expect(html).toContain('Bachelor&#x27;s, Master&#x27;s, PhD');
    expect(html).toContain('4 programmes');
    expect(html).toContain('Explore specialization');
    expect(html).toContain('All Computer Science specializations (12)');
  });

  it('hands an enquiry over with the specialization it was about', () => {
    expect(html).toContain(
      'href="/counselling?source=specialization&amp;subject=computer-science&amp;specialization=software-engineering&amp;from=%2Fsubjects%2Fcomputer-science%2Fsoftware-engineering"',
    );
    expect(html).not.toContain('href="/contact"');
  });

  it('always offers consultants, as the reference does', () => {
    expect(html).toContain('Talk to a consultant about Software Engineering');
    expect(html).toMatch(/id="consultants"/);
  });

  it('shows the subject’s scholarships when there are any, and says whose they are', () => {
    const funded = render([scholarship]);
    expect(funded).toMatch(/<h2 class="sec-title">Scholarships for Software Engineering<\/h2>/);
    expect(funded).toContain('Recorded against Computer Science');
    expect(funded).toContain('Talk to a consultant about Software Engineering');
    expect(funded).not.toMatch(/id="consultants"/);
  });
});

describe('a subject’s specializations page', () => {
  const branches = (subject.subSubjects ?? []).map((row) => ({ ...row }));
  const html = renderToStaticMarkup(
    <SpecializationsReference
      subject={{ ...subject, subSubjects: branches } as SubjectDetail}
      counts={{ 'software-engineering': 6 }}
      countries={[{ value: 'united-states', label: 'United States', count: 6 }]}
      query=""
      universities={[{ name: 'Lakeside', slug: 'lakeside', country: 'United States' }]}
      courses={[]}
      scholarships={[]}
      levelOrder={['DIPLOMA', 'UG', 'PG', 'PHD']}
    />,
  );

  it('links each card’s name to the specialization’s own page', () => {
    expect(html).toContain(
      '<h3 class="speccard__name"><a href="/subjects/computer-science/software-engineering">Software Engineering</a></h3>',
    );
  });

  it('keeps a way into the filtered courses, opening the list its count describes', () => {
    /* The card says "6 courses", so the link opens the course guides. */
    expect(html).toContain(
      'href="/courses?subject=computer-science&amp;specialization=software-engineering&amp;view=guides"',
    );
  });

  it('prints the levels where the subject’s initials used to be', () => {
    expect(html).toContain('<span class="speccard__levels">Diploma, Bachelor&#x27;s, PhD</span>');
    expect(html).not.toContain('>CS<');
  });

  it('opens a destination as the subject in that country', () => {
    expect(html).toContain('href="/study-abroad/united-states/computer-science"');
  });

  it('sends "all universities" to the ones teaching it', () => {
    expect(html).toContain('href="/universities?subject=computer-science"');
  });
});

describe('the subjects explorer', () => {
  const rows = [
    {
      ...subject,
      subSubjects: [{ id: 'se', name: 'Software Engineering', slug: 'software-engineering' }],
      levels: [
        { code: 'PHD', name: 'PhD' },
        { code: 'UG', name: "Bachelor's" },
      ],
    },
    {
      ...subject,
      id: 'eng',
      name: 'Engineering',
      slug: 'engineering',
      publishedCourseCount: 0,
      subSubjects: [{ id: 'ce', name: 'Civil Engineering', slug: 'civil-engineering' }],
      levels: [{ code: 'FOUNDATION', name: 'Foundation Program' }],
    },
  ];
  const ORDER = ['FOUNDATION', 'UG', 'PG', 'PHD'];

  it('names each card’s levels in climbing order', () => {
    searchParams.current = new URLSearchParams();
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    expect(html).toContain('Bachelor&#x27;s, PhD');
  });

  /* The client had the explorer's count line, its suggested searches and
     its study-level filter taken off: the question, the search box and
     the cards are the page. */
  it('opens on its question and its search, with no count line, suggestions or level filter', () => {
    searchParams.current = new URLSearchParams();
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    expect(html).not.toContain('hero__eyebrow');
    expect(html).not.toContain('Find your field');
    expect(html).not.toContain('bigsearch__ex');
    expect(html).not.toMatch(/>Try</);
    expect(html).not.toContain('aria-label="Study level"');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('>Foundation Program<');
    /* Every subject is a card. */
    expect(html.match(/<article class="subjcard"/g)).toHaveLength(2);
  });

  it('answers a specialization search with a count and a way back', () => {
    searchParams.current = new URLSearchParams('q=software');
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    expect(html).toMatch(/Results for “software”.*1 match/);
    expect(html).toMatch(/<a class="linkcta" href="\/subjects">All subjects/);
    expect(html).not.toContain('No subjects found');
    /* The cards the search keeps. */
    const results = html.slice(html.indexOf('id="taxonomy"'));
    expect(results).not.toContain('Civil Engineering');
  });

  it('prints no programme figure for a subject with none', () => {
    searchParams.current = new URLSearchParams();
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    expect(html).toContain('36 programmes profiled');
    expect(html).not.toContain('0 programmes profiled');
  });
});

/**
 * The client could not see the study levels on a catalogue with nothing
 * listed. The six they named now always show; the figures still count only
 * the levels something is listed at, and the section says once, not six
 * times, that nothing is listed yet.
 */
describe('the study levels, listed or not', () => {
  const catalogue = [
    { id: 'f', code: 'FOUNDATION', name: 'Foundation Program', educationOrder: 1 },
    { id: 'p', code: 'PATHWAY', name: 'Pathway Program', educationOrder: 2 },
    { id: 'u', code: 'UG', name: "Bachelor's", educationOrder: 3 },
    { id: 'g', code: 'PG', name: "Master's", educationOrder: 4 },
    { id: 'm', code: 'MBA', name: 'MBA', educationOrder: 5 },
    { id: 'h', code: 'PHD', name: 'PhD', educationOrder: 6 },
  ];
  const empty = { ...subject, courseCountsByLevel: [], featuredCourses: [] } as unknown as SubjectDetail;
  /* Nothing ticked on it or on its specializations: offered at no level. */
  const unoffered = {
    ...empty,
    subSubjects: empty.subSubjects.map((branch) => ({ ...branch, levels: [] })),
  } as SubjectDetail;
  const sectionIds = (html: string) =>
    [...html.matchAll(/<section class="coursegroup[^"]*" id="(level-[^"]+)"/g)].map((m) => m[1]);

  it('shows all six on a subject offered at no level, says so once, and offers no empty search', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide
        subject={unoffered}
        scholarships={[]}
        levels={everyLevel([], catalogue, subjectOfferedLevels(unoffered))}
      />,
    );
    expect(sectionIds(html)).toEqual([
      'level-foundation',
      'level-pathway',
      'level-ug',
      'level-pg',
      'level-mba',
      'level-phd',
    ]);
    expect(html.match(/is listed yet/g)).toHaveLength(1);
    expect(html).toContain('No Computer Science programme is listed yet.');
    expect(html).not.toContain('Every Computer Science programme');
  });

  it('with nothing ticked on the subject, shows the levels its specializations are offered at', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide
        subject={empty}
        scholarships={[]}
        levels={everyLevel([], catalogue, subjectOfferedLevels(empty))}
      />,
    );
    /* Its one specialization is ticked for Bachelor's, a diploma and PhD;
       the diploma is not one of this catalogue's levels. */
    expect(sectionIds(html)).toEqual(['level-ug', 'level-phd']);
  });

  it('shows all six on a specialization with nothing listed, without "View all 0"', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide
        specialization={specialization as never}
        scholarships={[]}
        levels={everyLevel([], catalogue)}
      />,
    );
    expect(sectionIds(html)).toHaveLength(6);
    expect(html).toContain('No Software Engineering programme is listed yet.');
    expect(html).not.toContain('View all 0');
  });
});

/**
 * A level's link opens the field's page at that level only where the field
 * has one -- a level it is offered at -- and the course finder otherwise:
 * a level page the field is not offered at is a 404.
 */
describe('level links that open pages that exist', () => {
  const groups = [
    { level: { ...DIPLOMA, educationOrder: 2 }, count: 2, courses: [] },
    { level: { ...PG, educationOrder: 4 }, count: 14, courses: [] },
  ] as never;

  it('sends a subject’s level with no page of its own to the course finder', () => {
    const html = renderToStaticMarkup(
      <SubjectGuide
        subject={{ ...subject, offeredLevels: [PG], subSubjects: [], courseCountsByLevel: [{ level: PG, count: 14 }] } as SubjectDetail}
        scholarships={[]}
        levels={groups}
      />,
    );
    expect(html).toContain('href="/subjects/computer-science/masters?view=guides"');
    expect(html).toContain('href="/courses?subject=computer-science&amp;level=DIPLOMA&amp;view=guides"');
    expect(html).not.toContain('/subjects/computer-science/diploma');
  });

  it('sends a specialization’s level with no page of its own to the course finder, narrowed to it', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide
        specialization={{ ...specialization, offeredLevels: [PG], levels: [PG] } as never}
        scholarships={[]}
        levels={groups}
      />,
    );
    expect(html).toContain('href="/subjects/computer-science/software-engineering/masters?view=guides"');
    expect(html).toContain(
      'href="/courses?subject=computer-science&amp;specialization=software-engineering&amp;level=DIPLOMA&amp;view=guides"',
    );
    expect(html).not.toContain('/software-engineering/diploma');
  });

  it('still opens the six level pages of a subject offered at nothing', () => {
    const catalogue = [
      { id: 'f', code: 'FOUNDATION', name: 'Foundation Program', educationOrder: 1 },
      { id: 'u', code: 'UG', name: "Bachelor's", educationOrder: 3 },
    ];
    const unoffered = {
      ...subject,
      courseCountsByLevel: [],
      subSubjects: [],
    } as unknown as SubjectDetail;
    const html = renderToStaticMarkup(
      <SubjectGuide subject={unoffered} scholarships={[]} levels={everyLevel([], catalogue, subjectOfferedLevels(unoffered))} />,
    );
    expect(html).toContain('href="/subjects/computer-science/foundation?view=guides"');
  });

  /* A level switched off in Admin leaves the catalogue's list; a subject
     offered there alone is offered at nothing, and its six pages open. */
  it('opens the six level pages of a subject offered only at a switched-off level', () => {
    const catalogue = [
      { id: 'f', code: 'FOUNDATION', name: 'Foundation Program', educationOrder: 1 },
      { id: 'u', code: 'UG', name: "Bachelor's", educationOrder: 3 },
    ];
    const switchedOff = {
      ...subject,
      offeredLevels: [],
      subSubjects: [],
      courseCountsByLevel: [{ level: DIPLOMA, count: 2 }],
    } as unknown as SubjectDetail;
    const html = renderToStaticMarkup(
      <SubjectGuide
        subject={switchedOff}
        scholarships={[]}
        catalogue={catalogue}
        levels={everyLevel(
          [{ level: { ...DIPLOMA, educationOrder: 2 }, count: 2, courses: [] }] as never,
          catalogue,
          subjectOfferedLevels(switchedOff),
        )}
      />,
    );
    expect(html).toContain('href="/subjects/computer-science/foundation?view=guides"');
    expect(html).toContain('href="/subjects/computer-science/bachelors?view=guides"');
    expect(html).toContain('href="/courses?subject=computer-science&amp;level=DIPLOMA&amp;view=guides"');
    expect(html).not.toContain('/subjects/computer-science/diploma');
  });

  it('opens the level pages of a specialization offered only at a switched-off level', () => {
    const catalogue = [{ id: 'u', code: 'UG', name: "Bachelor's", educationOrder: 3 }];
    const html = renderToStaticMarkup(
      <SpecializationGuide
        specialization={{ ...specialization, offeredLevels: [], levels: [DIPLOMA] } as never}
        scholarships={[]}
        catalogue={catalogue}
        levels={everyLevel([], catalogue, [DIPLOMA])}
      />,
    );
    expect(html).toContain('href="/subjects/computer-science/software-engineering/bachelors?view=guides"');
  });
});

/** The facts strip a specialization's page had -- its subject, its
 *  levels and its programmes -- went with the subject page's box: the
 *  client asked for both to go. */
describe('a specialization’s hero', () => {
  it('opens on its name, with no facts strip below', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide
        specialization={{ ...specialization, offeredLevels: [PG], levels: [UG, PG] } as never}
        scholarships={[]}
        levels={[
          { level: { ...UG, educationOrder: 3 }, count: 4, courses: [] },
          { level: { ...PG, educationOrder: 4 }, count: 2, courses: [] },
        ] as never}
      />,
    );
    expect(html).toContain('<h1 class="hero__h1">Study Software Engineering abroad</h1>');
    expect(html).not.toContain('specialization-facts');
    expect(html).not.toContain('unisnap');
    expect(html).not.toContain('Parent subject');
    expect(html).not.toMatch(/<span class="label">Study levels<\/span>/);
  });

  /* The client had the "Specialization · <subject>" line over the
     heading taken off, as the subject page's was: the name is the first
     line. The trail and "All <subject>" still lead back to the subject. */
  it('opens on its name, with no line above it, and keeps the ways back to its subject', () => {
    const html = renderToStaticMarkup(
      <SpecializationGuide specialization={specialization as never} scholarships={[]} />,
    );
    expect(html).not.toContain('hero__eyebrow');
    expect(html).not.toMatch(/Specialization<b>·<\/b>/);
    expect(html).toMatch(
      /<\/span>(?:<!-- -->)*<div><h1 class="hero__h1">Study Software Engineering abroad<\/h1>/,
    );
    expect(html).toContain(
      '<a href="/subjects/computer-science">Computer Science</a>' +
        '<span class="crumbs__sep" aria-hidden="true">/</span>' +
        '<span aria-current="page">Software Engineering</span>',
    );
    expect(html).toMatch(
      /<a class="btn btn--lg btn--ghost" href="\/subjects\/computer-science">All (?:<!-- -->)?Computer Science<\/a>/,
    );
  });
});

/** The consultants hand-off on a subject's page, awards or not. */
describe('a subject’s consultants hand-off', () => {
  it('stands alone where no award is recorded', () => {
    const html = renderToStaticMarkup(<SubjectGuide subject={subject} scholarships={[]} />);
    expect(html).toMatch(/id="consultants"/);
    expect(html).toContain('Talk to a consultant about Computer Science');
  });

  it('closes the funding band where awards are recorded', () => {
    const html = renderToStaticMarkup(<SubjectGuide subject={subject} scholarships={[scholarship]} />);
    expect(html).not.toMatch(/id="consultants"/);
    expect(html).toContain('Talk to a consultant about Computer Science');
  });
});

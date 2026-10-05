import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SubjectDetail } from '@/lib/catalog';
import type { ScholarshipCard } from '@/lib/scholarship-card';

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
    expect(html).toMatch(/<span class="label">Destinations<\/span><b>3<\/b>/);
    expect(html).toMatch(/<span class="label">Universities<\/span><b>105<\/b>/);
    expect(html).toContain('3 destinations teach Computer Science');
  });

  it('shows the overview’s opening on the page, the rest under the toggle', () => {
    expect(html).toContain(
      '<p class="ov__lead">Computer science is the study of computation itself.</p>',
    );
    expect(html).toContain('<p class="ov__more">It asks what can be computed and how well.</p>');
    expect(html).toContain('More about Computer Science');
    expect(html).toContain('Algorithms and systems.');
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
    const own = '/courses?subject=computer-science&amp;subSubject=software-engineering';
    /* The hero, the "view all" link, the match band and the connect band. */
    expect(html.split(`href="${own}"`).length - 1).toBe(4);
    expect(html).toContain('View all 6 Software Engineering programmes');
    expect(html).toMatch(/href="\/courses\?subject=computer-science">Every Computer Science programme/);
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

  it('keeps a way into the filtered courses', () => {
    expect(html).toContain(
      'href="/courses?subject=computer-science&amp;subSubject=software-engineering"',
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

  it('lays its level bar out in climbing order', () => {
    searchParams.current = new URLSearchParams();
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    const bar = [...html.matchAll(/aria-pressed="(?:true|false)">([^<]+)</g)].map(
      (match) => match[1],
    );
    expect(bar).toEqual(['All', 'Foundation Program', 'Bachelor&#x27;s', 'PhD']);
    expect(html).toContain('Bachelor&#x27;s, PhD');
  });

  it('answers a specialization search with a count and a way back', () => {
    searchParams.current = new URLSearchParams('q=software');
    const html = renderToStaticMarkup(
      <SubjectIndex subjects={rows as never} levelOrder={ORDER} />,
    );
    expect(html).toMatch(/Results for “software”.*1 match/);
    expect(html).toMatch(/<a class="linkcta" href="\/subjects">All subjects/);
    expect(html).not.toContain('No subjects found');
    expect(html).not.toContain('Civil Engineering');
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

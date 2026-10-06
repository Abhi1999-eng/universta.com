import { describe, expect, it, vi } from 'vitest';

/* The guide sits inside the Study Abroad shell, which supplies the
   assessment dialog through context. The bands that reach for it are not
   what these assertions are about, so the shell is stubbed rather than
   mounted. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));
/* A programme card's heart saves through the account and asks for the
   router; there is none mounted here. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/courses/msc-computer-science',
  useSearchParams: () => new URLSearchParams(),
}));
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseGuide } from './CourseGuide';
import type { CourseAvailability, CourseDetail } from '@/lib/catalog';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { toOfferingCard } from '@/lib/university-courses';

/**
 * The same programme is admitted on different terms in different countries,
 * and the catalogue has recorded those terms per country-course mapping all
 * along -- grade floors, English scores, work experience, application fees,
 * deadlines. The page fetched every one of them and threw them away, so a
 * reader comparing two destinations saw only their names.
 */
const availability = (over: Partial<CourseAvailability> = {}): CourseAvailability => ({
  id: 'a1',
  country: { id: 'c1', name: 'Germany', slug: 'germany' },
  ...over,
});

const course = (rows: CourseAvailability[]): CourseDetail =>
  ({
    id: 'course-1',
    name: 'MSc Computer Science',
    slug: 'msc-computer-science',
    shortDescription: null,
    overview: null,
    careerSummary: null,
    qualificationName: null,
    credits: null,
    featuredMedia: null,
    availableCountryCount: rows.length,
    subject: { id: 's1', name: 'Computing', slug: 'computing' },
    subSubject: null,
    courseLevel: { id: 'l1', name: 'Postgraduate', code: 'PG' },
    studyModes: [],
    duration: { min: null, max: null, unit: null },
    availability: rows,
    selectedCountry: null,
    contentSections: [],
    faqs: [],
    relatedCourses: [],
    seo: null,
    jsonLd: {},
  }) as unknown as CourseDetail;

const html = (rows: CourseAvailability[], scholarships: unknown[] = []) =>
  renderToStaticMarkup(
    <CourseGuide
      course={course(rows)}
      scholarships={toScholarshipCards(scholarships)}
    />,
  );

describe('what each destination asks for', () => {
  it('prints the grade floors a destination set', () => {
    const markup = html([
      availability({ academicRequirements: { percentage: '70', cgpa: '3.2' } }),
    ]);
    expect(markup).toContain('Academic minimum');
    expect(markup).toContain('70%');
    expect(markup).toContain('3.2');
  });

  it('prints only the English tests it named a number for', () => {
    const markup = html([
      availability({ englishRequirements: { ielts: '6.5', toefl: null, pte: null, duolingo: null } }),
    ]);
    expect(markup).toContain('IELTS');
    expect(markup).not.toContain('Duolingo');
  });

  it('prints the intakes with their deadlines', () => {
    const markup = html([
      availability({
        intakes: [
          {
            id: 'i1',
            intake: { id: 'x', name: 'September', slug: 'september' },
            applicationDeadline: '2027-01-15T00:00:00.000Z',
          },
        ],
      }),
    ]);
    expect(markup).toContain('September');
    expect(markup).toContain('2027-01-15');
  });

  it('says a deadline is unpublished rather than leaving the cell blank', () => {
    const markup = html([
      availability({
        intakes: [{ id: 'i1', intake: { id: 'x', name: 'September', slug: 'september' } }],
      }),
    ]);
    expect(markup).toContain('Deadline not published');
  });

  it('carries the prose an editor wrote for that destination', () => {
    const markup = html([
      availability({
        admissionRequirements: 'A quantitative bachelor’s degree.',
        applicationNotes: 'Assessed in rounds.',
      }),
    ]);
    expect(markup).toContain('A quantitative bachelor’s degree.');
    expect(markup).toContain('Assessed in rounds.');
  });

  it('links the source the figures were taken from', () => {
    const markup = html([
      availability({
        tuition: { min: '100', currencyCode: 'EUR' },
        sourceReference: 'https://example.invalid/programme',
        verifiedAt: '2026-10-02T00:00:00.000Z',
      }),
    ]);
    expect(markup).toContain('https://example.invalid/programme');
    expect(markup).toContain('checked 2026-10-02');
  });

  it('gives a destination a card only when it recorded something', () => {
    /* A mapping that is only a country name adds a card saying nothing,
       which is worse than no card at all. */
    expect(html([availability()])).not.toContain('What each destination asks for');
  });

  it('shows the section as soon as one destination has something to say', () => {
    const markup = html([
      availability(),
      availability({
        id: 'a2',
        country: { id: 'c2', name: 'Ireland', slug: 'ireland' },
        englishRequirements: { ielts: '6.5' },
      }),
    ]);
    expect(markup).toContain('What each destination asks for');
    expect(markup).toContain('Ireland');
  });

  it('counts the destinations band and this one separately in the numbering', () => {
    const markup = html([availability({ englishRequirements: { ielts: '6.5' } })]);
    expect(markup).toContain('01');
    expect(markup).toContain('02');
  });
});

/**
 * The facts under the hero ran together as "1–2 yearsFull time12
 * destinations" in an unstyled line. They are the design's "At a glance"
 * panel now, as on a programme's page, and every fact the line held is
 * still there.
 */
describe('the course at a glance', () => {
  const full = (over: Partial<CourseDetail> = {}) =>
    ({
      ...course([
        availability(),
        availability({ id: 'a2', country: { id: 'c2', name: 'United Kingdom', slug: 'united-kingdom' } }),
      ]),
      qualificationName: 'Master of Science',
      duration: { min: '1.00', max: '2.00', unit: 'YEARS' },
      studyModes: [{ id: 'f', name: 'Full time', code: 'FULL_TIME' }],
      ...over,
    }) as CourseDetail;
  const panel = (markup: string) =>
    /<aside class="snap coursefacts"[^>]*>.*?<\/aside>/.exec(markup)?.[0] ?? '';

  it('holds the level, the length, how it is taught and how many destinations', () => {
    const facts = panel(renderToStaticMarkup(<CourseGuide course={full()} />));
    expect(facts).toContain('At a glance');
    expect(facts).toContain('Postgraduate');
    expect(facts).toContain('Master of Science');
    expect(facts).toContain('1–2 years');
    expect(facts).toContain('Full time');
    expect(facts).toContain('2 destinations');
  });

  it('no longer runs the facts together in one line', () => {
    const markup = renderToStaticMarkup(<CourseGuide course={full()} />);
    expect(markup).not.toMatch(/<div class="coursefacts">/);
    expect(markup).not.toContain('<span class="datum">');
  });

  it('says what it does not know rather than dropping the row', () => {
    const facts = panel(
      renderToStaticMarkup(
        <CourseGuide
          course={full({ duration: { min: null, max: null, unit: null }, studyModes: [] })}
        />,
      ),
    );
    expect(facts).toMatch(/Duration<\/span><span class="snap__v uc-none">Not listed/);
    expect(facts).toMatch(/Study mode<\/span><span class="snap__v uc-none">Not listed/);
  });

  it('under a destination, states that destination’s fee and intakes', () => {
    const uk = availability({
      id: 'a2',
      country: { id: 'c2', name: 'United Kingdom', slug: 'united-kingdom' },
      tuition: { min: '30000', max: '30000', currencyCode: 'GBP', period: 'PER_YEAR' },
      intakes: [{ id: 'i1', intake: { id: 'x', name: 'September', slug: 'september' } }],
    });
    const facts = panel(
      renderToStaticMarkup(
        <CourseGuide course={full({ availability: [uk] })} country="united-kingdom" />,
      ),
    );
    expect(facts).toMatch(/Destination<\/span><span class="snap__v">United Kingdom/);
    expect(facts).toContain('GBP 30,000');
    expect(facts).toContain('A year');
    expect(facts).toMatch(/Intake<\/span><span class="snap__v">September/);
    expect(facts).toContain('What the catalogue records for the United Kingdom.');
  });

  it('under a destination that records no fee, says so', () => {
    const facts = panel(
      renderToStaticMarkup(
        <CourseGuide
          course={full({
            availability: [
              availability({ id: 'a2', country: { id: 'c2', name: 'United Kingdom', slug: 'united-kingdom' } }),
            ],
          })}
          country="united-kingdom"
        />,
      ),
    );
    expect(facts).toMatch(/Tuition<\/span><span class="snap__v uc-none">Not listed/);
    expect(facts).toMatch(/Intake<\/span><span class="snap__v uc-none">Not listed/);
  });

  it('wraps its row of destinations, which ran off the side of a phone', () => {
    const markup = renderToStaticMarkup(<CourseGuide course={full()} />);
    expect(markup).toMatch(/<div class="citychips"><a class="chipbtn" href="\/study-abroad\/germany">/);
    expect(markup).not.toContain('chip-row');
  });
});

/**
 * The generic course page never said which universities teach the course,
 * though every programme names the course it is an instance of. It lists
 * them now, narrowed to the destination it was opened under, and hands on
 * to all of them in the finder.
 */
describe('where the course is taught', () => {
  const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
  const programme = (n: number) =>
    toOfferingCard({
      id: `p${n}`,
      slug: `university-${n}-msc-computer-science`,
      name: 'MSc Computer Science',
      genericCourse: { name: 'MSc Computer Science', slug: 'msc-computer-science' },
      university: {
        name: `University ${n}`,
        slug: `university-${n}`,
        country: uk,
        campuses: [{ city: 'Coventry' }],
      },
    })!;
  const sample = (count: number, total = count) => ({
    cards: Array.from({ length: count }, (_, index) => programme(index + 1)),
    total,
    universities: total,
    cities: 3,
  });
  const markup = (programmes: ReturnType<typeof sample> | null, country?: string) =>
    renderToStaticMarkup(
      <CourseGuide
        course={course([availability()])}
        programmes={programmes}
        country={country}
      />,
    );

  it('draws the first six as cards, each opening its programme at its nested address', () => {
    const html = markup(sample(2));
    expect(html).toContain('Where it is taught');
    expect(html.match(/class="coursecard"/g)).toHaveLength(2);
    expect(html).toContain(
      'href="/study-abroad/united-kingdom/universities/university-1/courses/university-1-msc-computer-science"',
    );
    expect(html).toContain('2 programmes at 2 universities');
  });

  it('names every university it read, the ones past six a line each', () => {
    const html = markup(sample(8));
    expect(html.match(/class="coursecard"/g)).toHaveLength(6);
    expect(html).toContain('Also taught at');
    expect(html).toMatch(
      /<a class="courselist__row" href="\/study-abroad\/united-kingdom\/universities\/university-8\/courses\/university-8-msc-computer-science"><span class="courselist__name">University 8<\/span>/,
    );
    expect(html).toContain('Fee not listed');
  });

  it('sends "See all" to the finder narrowed to this course', () => {
    expect(markup(sample(2, 19))).toMatch(
      /<a class="linkcta" href="\/courses\?course=msc-computer-science">See all 19 programmes/,
    );
  });

  it('keeps the destination it was opened under in the finder', () => {
    expect(markup(sample(1, 3), 'germany')).toContain(
      'href="/courses?course=msc-computer-science&amp;country=germany"',
    );
    expect(markup(sample(1, 3), 'germany')).toContain('3 programmes at 3 universities in Germany');
  });

  it('stands down when no university teaches it, as every course does while there are no programmes', () => {
    for (const html of [markup(null), markup(sample(0, 0))]) {
      expect(html).not.toContain('Where it is taught');
      expect(html).not.toContain('id="taught"');
      expect(html).not.toContain('class="coursecard"');
    }
  });

  it('numbers the section in the run', () => {
    const html = markup(sample(1));
    expect(html).toMatch(/<a href="#taught">Universities<\/a>/);
    expect(html).toMatch(/02<\/span> Universities/);
  });

  it('gives its cards no "Course guide", which would lead back to this page', () => {
    for (const html of [markup(sample(6)), markup(sample(2, 3), 'united-kingdom')]) {
      const taught = html.slice(html.indexOf('id="taught"'));
      expect(taught.match(/class="coursecard"/g)?.length).toBeGreaterThan(0);
      expect(taught).not.toContain('coursecard__guide');
      expect(taught).not.toContain('href="/courses/msc-computer-science"');
      /* Each card still opens its programme and its eligibility. */
      expect(taught).toContain('>Check eligibility</a>');
    }
  });
});

/**
 * A scholarship can be recorded against the offerings that teach a
 * programme, and the course page never asked for them. A reader deciding
 * whether they could afford the course was told nothing about the money
 * attached to it.
 */
describe('funding on a course', () => {
  const award = {
    id: 'sch-1',
    title: 'DAAD Masters Award',
    slug: 'daad-masters',
    benefitType: 'FULL_TUITION',
    amount: '12000.00',
    currencyCode: 'EUR',
    deadline: '2027-01-15',
    provider: { name: 'DAAD' },
  };

  it('opens a funding band when an award is recorded against the programme', () => {
    const markup = html([availability()], [award]);
    expect(markup).toContain('Scholarships for MSc Computer Science');
    expect(markup).toContain('DAAD Masters Award');
    expect(markup).toContain('EUR 12,000');
    expect(markup).toContain('15 Jan 2027');
  });

  it('says plainly that eligibility is not an award', () => {
    expect(html([availability()], [award])).toContain(
      'not a guarantee of an award',
    );
  });

  it('counts one award as one and two as two', () => {
    expect(html([availability()], [award])).toContain('1 award is');
    expect(
      html([availability()], [award, { ...award, id: 'sch-2', slug: 'other' }]),
    ).toContain('2 awards are');
  });

  it('stands the band down when the catalogue records no funding', () => {
    expect(html([availability()])).not.toContain('Scholarships for');
  });

  it('keeps the numbered run sequential with the band in it', () => {
    const markup = html([availability({ englishRequirements: { ielts: '6.5' } })], [award]);
    expect(markup).toContain('01');
    expect(markup).toContain('02');
    expect(markup).toContain('03');
    expect(markup).not.toContain('04');
  });
});

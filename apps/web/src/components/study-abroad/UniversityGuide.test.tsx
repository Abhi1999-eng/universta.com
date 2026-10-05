import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  UniversityGuide,
  programmeName,
  type UniversityDestination,
  type UniversityRecord,
} from './UniversityGuide';
import { toScholarshipCards } from '@/lib/scholarship-card';

/* The page's assessment buttons open the dialog the route family's shell
   owns; rendered on their own, there is no shell to reach. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {} }),
}));

/** The markup's text as a reader sees it: React marks the seams between
 *  adjacent pieces of text with empty comments. */
const plain = (markup: string) => markup.replace(/<!-- -->/g, '');

/**
 * The approved build's university template carries twelve sections. Most
 * read a record this catalogue keeps against a programme or a destination
 * rather than against an institution -- admission thresholds, a fee table,
 * scholarships, campus life, graduate outcomes -- and its profile-fit panel
 * is scored against a student profile this product does not collect. What
 * renders here is what the catalogue actually holds, and a section with
 * nothing behind it stands down rather than printing a dash.
 */

const offering = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  name: 'Master of Data Science at Elmswood Polytechnic University',
  slug: 'elmswood-master-of-data-science',
  shortDescription: null,
  qualificationName: 'MSc',
  subject: { name: 'Computer Science', slug: 'computer-science' },
  specialization: null,
  courseLevel: { code: 'PG', name: 'Postgraduate' },
  duration: { min: '2', max: '2', unit: 'YEARS' },
  ...over,
});

const university = (over: Partial<UniversityRecord> = {}): UniversityRecord =>
  ({
    id: 'u1',
    name: 'Elmswood Polytechnic University',
    slug: 'elmswood-polytechnic-university-germany',
    shortDescription: 'A polytechnic in Germany.',
    overview: null,
    institutionType: 'PUBLIC',
    qsRanking: null,
    totalStudents: null,
    internationalStudentsPercent: null,
    studentFacultyRatio: null,
    establishedYear: null,
    campusSetting: null,
    websiteUrl: null,
    admissionsEmail: null,
    phone: null,
    statsSourceName: null,
    statsSourceUrl: null,
    statsYear: null,
    sourceReference: null,
    verifiedAt: null,
    campuses: 0,
    country: {
      name: 'Germany',
      slug: 'germany',
      iso2Code: 'DE',
      officialLanguage: 'German',
      currencyCode: 'EUR',
      currencySymbol: '€',
      intakeMonths: [10, 4],
      postStudyWorkPermitMonths: null,
    },
    offerings: [offering()],
    ...over,
  }) as UniversityRecord;

const render = (record: UniversityRecord, scholarships: unknown[] = []) =>
  renderToStaticMarkup(
    <UniversityGuide
      university={record}
      scholarships={toScholarshipCards(scholarships)}
    />,
  );

describe('a university’s guide', () => {
  it('names the institution once in the programme list, not on every card', () => {
    /* "Master of Data Science at Elmswood Polytechnic University" is the
       right name in a search result and a stutter down a column of nine. */
    expect(
      programmeName(
        'Master of Data Science at Elmswood Polytechnic University',
        'Elmswood Polytechnic University',
      ),
    ).toBe('Master of Data Science');
  });

  it('leaves a name that does not carry the institution alone', () => {
    expect(programmeName('MSc Data Science', 'Elmswood')).toBe(
      'MSc Data Science',
    );
  });

  it('fills the snapshot only with cells it can answer', () => {
    const html = render(university());
    expect(html).toContain('Germany');
    expect(html).toContain('German');
    expect(html).toContain('EUR €');
    /* Months come back as months, in order, not as the numbers stored. */
    expect(html).toContain('April · October');
    /* No campuses recorded, so no campus cell at all rather than a zero. */
    expect(html).not.toContain('Campuses');
    expect(html).not.toContain('QS ranking');
  });

  it('adds the cells a fuller record earns', () => {
    const html = render(
      university({ campuses: 3, qsRanking: 412 }),
    );
    expect(html).toContain('Campuses');
    expect(html).toContain('#412');
    expect(html).toContain('Ranking is one factor among many');
  });

  it('stands the overview down when there is none', () => {
    expect(render(university())).not.toContain('About this university');
    expect(
      render(university({ overview: '<p>Two campuses on the river.</p>' })),
    ).toContain('About this university');
  });

  it('stands the programmes down when the catalogue has none', () => {
    const html = render(university({ offerings: [] }));
    expect(html).not.toContain('Programmes at');
    expect(html).not.toContain('See its programmes');
  });

  it('points each programme at its page under this university, filed under its country', () => {
    expect(render(university())).toContain(
      'href="/study-abroad/germany/universities/elmswood-polytechnic-university-germany/courses/elmswood-master-of-data-science"',
    );
  });

  it('numbers the sections that render, with no gaps', () => {
    const html = render(university({ overview: '<p>About.</p>' }));
    const numbers = [...html.matchAll(/eyebrow__n">(\d+)</g)].map((m) => m[1]);
    /* Overview, courses, the destination and the questions it answers. */
    expect(numbers).toEqual(['02', '03', '04', '05']);
  });

  it('always says to check with the university before applying', () => {
    expect(render(university())).toContain('Check before you apply');
  });

  it('cites the source and the date only when it has them', () => {
    expect(render(university())).not.toContain('Last checked');
    const html = render(
      university({
        verifiedAt: '2026-10-01T00:00:00.000Z',
        sourceReference: 'https://example.org/elmswood',
      }),
    );
    expect(html).toContain('Last checked 2026-10-01');
    expect(html).toContain('https://example.org/elmswood');
  });
});

/**
 * How big an institution is, how international, and how crowded are the
 * figures a student compares institutions on, and the catalogue had
 * nowhere to keep them. They are somebody else's counts, so the page says
 * whose and from when -- and when nobody has said, it admits that too
 * rather than presenting a number as settled.
 */
describe('the figures a university is compared on', () => {
  const html = (over: Partial<UniversityRecord>) =>
    renderToStaticMarkup(<UniversityGuide university={university(over)} />);

  it('shows the student count in a readable form', () => {
    expect(html({ totalStudents: 22005 })).toContain('22,005');
  });

  it('shows how many come from abroad', () => {
    expect(html({ internationalStudentsPercent: '43' })).toContain('43%');
  });

  it('shows how many students there are per member of staff', () => {
    const markup = html({ studentFacultyRatio: '10.4' });
    expect(markup).toContain('Students per staff');
    expect(markup).toContain('10.4');
  });

  it('names who published the figures, and when', () => {
    const markup = html({
      totalStudents: 22005,
      statsSourceName: 'Times Higher Education',
      statsYear: 2026,
    });
    expect(markup).toContain('Times Higher Education, 2026');
    expect(markup).toContain('does not count them itself');
  });

  it('links the source when there is one to link', () => {
    expect(
      html({
        totalStudents: 22005,
        statsSourceName: 'Times Higher Education',
        statsSourceUrl: 'https://example.invalid/the',
      }),
    ).toContain('https://example.invalid/the');
  });

  it('says a figure is unsourced rather than letting it pass as settled', () => {
    const markup = html({ totalStudents: 22005 });
    expect(markup).toContain('without a published source');
  });

  it('says nothing about sources when it has no figures to source', () => {
    const markup = html({});
    expect(markup).not.toContain('without a published source');
    expect(markup).not.toContain('does not count them itself');
  });

  it('leaves out every figure the record does not hold', () => {
    const markup = html({});
    for (const label of [
      'Students per staff',
      'International',
      'Founded',
      'Setting',
    ])
      expect(markup).not.toContain(label);
  });

  it('writes the campus setting as a word, not a shout', () => {
    expect(html({ campusSetting: 'URBAN' })).toContain('Urban');
  });
});

/**
 * Anything on the page can change between intakes, so the institution's own
 * channels are worth offering. The section stands down entirely when the
 * record has none, like every other band here.
 */
describe('reaching the university itself', () => {
  const html = (over: Partial<UniversityRecord>) =>
    renderToStaticMarkup(<UniversityGuide university={university(over)} />);

  it('offers the official website', () => {
    expect(html({ websiteUrl: 'https://example.invalid' })).toContain(
      'Official website',
    );
  });

  it('offers the admissions address as a mail link', () => {
    expect(html({ admissionsEmail: 'admissions@example.invalid' })).toContain(
      'mailto:admissions@example.invalid',
    );
  });

  it('strips a phone number down to something dialable', () => {
    expect(html({ phone: '+44 1865 270000' })).toContain('tel:+441865270000');
  });

  it('stands the section down when there is no way to make contact', () => {
    expect(html({})).not.toContain('Ask the university directly');
  });
});

/**
 * The catalogue has always been able to record a scholarship against an
 * institution, and the university page never asked for one. A student
 * reading about a university was told what it teaches and what it costs,
 * and nothing about the money attached to studying there.
 */
describe('funding at a university', () => {
  const award = {
    id: 'sch-1',
    title: 'International Merit Scholarship',
    slug: 'international-merit',
    benefitType: 'PARTIAL_TUITION',
    amount: '5000.00',
    currencyCode: 'EUR',
    deadline: '2027-05-01',
    provider: { name: 'Elmswood Polytechnic University' },
    countries: [{ country: { name: 'Germany', slug: 'germany', iso2Code: 'DE' } }],
  };
  const html = (scholarships: unknown[]) => render(university(), scholarships);

  it('opens a funding band for the awards recorded against it', () => {
    const markup = html([award]);
    expect(markup).toContain('Scholarships at Elmswood Polytechnic University');
    expect(markup).toContain('International Merit Scholarship');
    expect(markup).toContain('EUR 5,000');
    expect(markup).toContain('1 May 2027');
  });

  it('says plainly that eligibility is not an award', () => {
    expect(html([award])).toContain('not a guarantee of an award');
  });

  it('does not repeat the destination the university already states', () => {
    /* The snapshot above it names the country; a flag chip on every card
       would be the same fact a third time. */
    expect(html([award])).not.toContain('flagchip');
  });

  it('stands the band down when no award is recorded', () => {
    expect(html([])).not.toContain('Scholarships at');
  });

  it('keeps the numbered run sequential with the band in it', () => {
    /* The snapshot holds place 01 without printing it, so the visible run
       starts at 02. The band takes its place in that run rather than being
       appended, and the section after it carries the next number. */
    const markup = html([award]);
    expect(markup).toContain('>02</span> Courses');
    expect(markup).toContain('>03</span> Funding');
    expect(markup).toContain('>04</span> Destination');
  });

  it('counts every award, not only the cards it shows, and opens the full list', () => {
    /* The page asks for the first four. The count in the lead and on the
       button is the total the catalogue reports. */
    const markup = renderToStaticMarkup(
      <UniversityGuide
        university={university()}
        scholarships={toScholarshipCards([award])}
        scholarshipTotal={9}
      />,
    );
    expect(markup).toContain('9 awards are recorded against this institution');
    expect(markup).toContain(
      'href="/scholarships?university=elmswood-polytechnic-university-germany"',
    );
    expect(plain(markup)).toContain('View all 9 scholarships');
    expect(markup).toContain('Find scholarships for my profile');
  });
});

const offeringAt = (
  index: number,
  level: { code: string; name: string; order: number },
  over: Record<string, unknown> = {},
) =>
  offering({
    id: `o${index}`,
    name: `Course ${String.fromCharCode(90 - index)} at Elmswood Polytechnic University`,
    slug: `course-${index}`,
    courseLevel: level,
    ...over,
  });
const UG = { code: 'UG', name: "Bachelor's", order: 303 };
const PG = { code: 'PG', name: "Master's", order: 404 };

/**
 * How a student moves from one university back to its country and on to
 * the rest of what it teaches. The behaviour reference files a university
 * under its destination, shows six of its courses with the way to the
 * rest, and closes with three more universities from the same country.
 */
describe('a university within its destination', () => {
  const html = (over: Partial<UniversityRecord> = {}, destination?: UniversityDestination) =>
    renderToStaticMarkup(
      <UniversityGuide university={university(over)} destination={destination} />,
    );

  it('leads back through the country to its universities in the breadcrumb', () => {
    const markup = html();
    const crumbs = markup.slice(markup.indexOf('class="crumbs"'), markup.indexOf('</nav>'));
    expect([...crumbs.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).toEqual([
      '/',
      '/study-abroad',
      '/study-abroad/germany',
      '/study-abroad/germany/universities',
    ]);
    expect(crumbs).toContain('aria-current="page">Elmswood Polytechnic University');
  });

  it('falls back to the worldwide list when the record has no country', () => {
    const markup = html({ country: null });
    const crumbs = markup.slice(markup.indexOf('class="crumbs"'), markup.indexOf('</nav>'));
    expect(crumbs).toContain('href="/universities"');
    expect(crumbs).not.toContain('/study-abroad');
  });

  it('says where the university is, with the country as a link to its guide', () => {
    const markup = html({ city: 'Bremen', establishedYear: 1971 });
    expect(markup).toMatch(/unihero__where.*Bremen, .*href="\/study-abroad\/germany">Germany</);
    expect(markup).toContain('Founded 1971');
    expect(markup).toContain('Bremen, Germany');
    expect(markup).toContain('href="/compare/universities?items=elmswood-polytechnic-university-germany"');
  });

  it('shows six courses, Bachelor’s first and A to Z, then the way to all of them', () => {
    const offerings = [
      ...[1, 2, 3, 4].map((index) => offeringAt(index, PG)),
      ...[5, 6, 7, 8, 9].map((index) => offeringAt(index, UG)),
    ];
    const markup = html({ offerings: offerings as UniversityRecord['offerings'] });
    const names = [...markup.matchAll(/coursecard__name"><a[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(names).toEqual(['Course Q', 'Course R', 'Course S', 'Course T', 'Course U', 'Course V']);
    expect(markup).toContain('Showing 6 of 9');
    expect(markup).toContain(
      'href="/study-abroad/germany/universities/elmswood-polytechnic-university-germany/courses"',
    );
    expect(plain(markup)).toContain('View all 9 courses');
  });

  it('offers the full list even when every course already fits', () => {
    const markup = html();
    expect(markup).toContain('Showing all 1');
    expect(plain(markup)).toContain('View all 1 course');
  });

  it('names the subjects it teaches most, each opening that subject in its country', () => {
    const markup = html({
      offerings: [
        offeringAt(1, UG),
        offeringAt(2, UG),
        offeringAt(3, UG, { subject: { name: 'Law', slug: 'law' } }),
      ] as UniversityRecord['offerings'],
    });
    expect(markup).toContain('Popular subjects here');
    expect(markup).toContain(
      'href="/study-abroad/germany/computer-science">Computer Science<em>2</em>',
    );
    expect(markup).toContain('href="/study-abroad/germany/law">Law<em>1</em>');
  });

  it('closes with three more universities from the same country and the way to all of them', () => {
    const other = (index: number) => ({
      id: `u${index}`,
      name: `Other ${index}`,
      slug: `other-${index}`,
      institutionType: 'PUBLIC',
      qsRanking: index === 1 ? 40 : null,
      shortDescription: null,
      totalStudents: null,
      internationalStudentsPercent: null,
      city: index === 1 ? 'Munich' : null,
      programmes: index,
    });
    const markup = html({
      otherUniversities: [1, 2, 3].map(other),
      otherUniversityTotal: 12,
    });
    expect(markup).toContain('More universities in Germany');
    expect(markup).toContain('href="/universities/other-1"');
    expect(markup).toContain('Munich, Germany');
    expect(plain(markup)).toContain('Ranked #40');
    expect(markup).toContain('12 other universities in Germany are on Universta.');
    expect(markup).toContain('href="/compare/universities?items=elmswood-polytechnic-university-germany,other-1"');
    expect(markup).toMatch(/href="\/study-abroad\/germany\/universities">View all universities in Germany/);
  });

  it('leaves the block out when the country has no other university', () => {
    expect(html({ otherUniversities: [] })).not.toContain('id="similar"');
  });

  it('points "other universities" at the country’s own list, not a worldwide search', () => {
    const markup = html();
    expect(markup).toContain('href="/study-abroad/germany/universities"><span class="cchip__name">Other universities in ');
    expect(markup).not.toContain('/universities?q=');
  });

  it('links into the parts of the destination guide that exist, and offers its consultants', () => {
    const markup = html({}, {
      consultants: { total: 3, cities: [{ city: 'Berlin', count: 2 }] },
      links: [{ key: 'visa', label: 'Student visa', href: '/study-abroad/germany#country-visa-process' }],
      costHref: null,
    });
    expect(markup).toContain('href="/study-abroad/germany#country-visa-process"');
    expect(markup).toContain('Need help applying to Elmswood Polytechnic University?');
    expect(markup).toContain('id="consultants"');
  });

  it('has no consultants band when nobody is recorded for the destination', () => {
    expect(
      html({}, { consultants: { total: 0, cities: [] }, links: [], costHref: null }),
    ).not.toContain('id="consultants"');
  });
});

describe('the strip of section links', () => {
  const tabs = (markup: string) =>
    [...markup.slice(markup.indexOf('unitabs')).matchAll(/<a href="#([a-z]+)"/g)].map((m) => m[1]);

  it('lists only the sections that render', () => {
    expect(tabs(renderToStaticMarkup(<UniversityGuide university={university()} />))).toEqual([
      'programmes',
      'destination',
      'faqs',
    ]);
  });

  it('grows with the record', () => {
    const markup = renderToStaticMarkup(
      <UniversityGuide
        university={university({
          overview: '<p>About.</p>',
          websiteUrl: 'https://example.invalid',
        })}
      />,
    );
    expect(tabs(markup)).toEqual(['about', 'programmes', 'contact', 'destination', 'faqs']);
  });
});

describe('what the courses record, shown on the page', () => {
  const html = (over: Record<string, unknown>) =>
    renderToStaticMarkup(
      <UniversityGuide
        university={university({ offerings: [offering(over)] as UniversityRecord['offerings'] })}
      />,
    );

  it('says outright when a course records no fee, in the course pages’ words', () => {
    expect(html({})).toContain('Not listed');
    expect(html({})).not.toContain('Not recorded');
  });

  it('says nothing about student figures when the only figure is the founding year', () => {
    const markup = renderToStaticMarkup(
      <UniversityGuide university={university({ establishedYear: 1965 })} />,
    );
    expect(markup).toContain('1965');
    expect(markup).not.toContain('Student figures');
  });

  it('still says where student figures come from when they are shown', () => {
    const markup = renderToStaticMarkup(
      <UniversityGuide university={university({ totalStudents: 29000 })} />,
    );
    expect(markup).toContain('Student figures');
  });

  it('shows the fee, the study mode and the intake when the course has them', () => {
    const markup = html({
      studyMode: 'FULL_TIME',
      tuition: { min: '18000', max: null, currencyCode: 'EUR', period: 'PER_YEAR' },
      intakes: [{ key: 'oct', name: 'October', month: 10, deadline: '2027-06-01' }],
    });
    expect(markup).toContain('EUR 18,000 per year');
    expect(markup).toContain('Full time');
    expect(markup).toContain('October');
    expect(markup).toContain('id="fees"');
    expect(markup).toContain('What a year here costs');
    expect(markup).toContain('id="intakes"');
    expect(markup).toContain('1 June 2027');
  });

  it('leaves out the fees and intakes sections when no course records either', () => {
    const markup = html({});
    expect(markup).not.toContain('id="fees"');
    expect(markup).not.toContain('id="intakes"');
  });

  it('tags a course with its specialization, opened in the country', () => {
    expect(html({ specialization: { name: 'Machine Learning', slug: 'machine-learning' } })).toContain(
      'href="/study-abroad/germany/computer-science/machine-learning">Machine Learning',
    );
  });

  it('offers to check eligibility on every card', () => {
    expect(html({})).toContain('Check eligibility');
  });

  it('says "1 year", not "1 years"', () => {
    expect(html({ duration: { min: '1', max: '1', unit: 'YEARS' } })).toContain('1 year<');
  });
});

describe('the overview', () => {
  it('states the opening sentence once under the heading, then the numbered highlights', () => {
    const markup = renderToStaticMarkup(
      <UniversityGuide
        university={university({
          shortDescription: 'A polytechnic in Germany.',
          overview:
            '<p>A polytechnic in Germany.</p><p>On the river.</p><h3>Strong in</h3><p>Engineering.</p>',
        })}
      />,
    );
    const about = markup.slice(markup.indexOf('id="about"'), markup.indexOf('id="programmes"'));
    expect(about.match(/A polytechnic in Germany\./g)).toHaveLength(1);
    expect(about).toContain('On the river.');
    expect(about).toContain('rulegrid__n">01');
    expect(about).toContain('rulegrid__t">Strong in');
  });
});

describe('questions the record answers', () => {
  const html = (over: Partial<UniversityRecord> = {}, scholarshipTotal?: number) =>
    renderToStaticMarkup(
      <UniversityGuide university={university(over)} scholarshipTotal={scholarshipTotal} />,
    );

  it('asks only what the record can answer', () => {
    const markup = html({ institutionType: null, establishedYear: null });
    expect(markup).toContain('Where is Elmswood Polytechnic University?');
    expect(markup).toContain('What can I study at Elmswood Polytechnic University?');
    expect(markup).not.toContain('What kind of institution');
  });

  it('answers from the record', () => {
    const markup = html({ establishedYear: 1971, city: 'Bremen' });
    expect(markup).toContain('Elmswood Polytechnic University is in Bremen, in Germany.');
    expect(markup).toContain('It was founded in 1971.');
    expect(markup).toContain('In Germany the main intakes are April and October');
  });

  it('says plainly when no scholarship is linked', () => {
    expect(html()).toContain('None is linked to Elmswood Polytechnic University in our catalogue yet.');
  });
});

/**
 * A university's intakes, as its courses record them. The snapshot named
 * the destination's months while the intakes band and the questions on the
 * same page named the courses' own, and the band gave a deadline already
 * gone as the one to meet.
 */
describe('intakes and deadlines', () => {
  /* Lakeside's courses: January and May intakes, closing on 15 September,
     15 October and 15 November, read on 5 October. */
  const lakeside = (deadlines: string[]) =>
    university({
      offerings: deadlines.map((deadline, index) =>
        offering({
          id: `o${index}`,
          slug: `course-${index}`,
          intakes: [
            { key: 'jan', name: 'January', month: 1, deadline },
            { key: 'may', name: 'May', month: 5, deadline },
          ],
        }),
      ) as UniversityRecord['offerings'],
    });
  const snapshotOf = (markup: string) =>
    plain(markup.slice(markup.indexOf('id="snapshot"'), markup.indexOf('class="verifybar"')));
  const intakesOf = (markup: string) => {
    const start = markup.indexOf('id="intakes"');
    return plain(markup.slice(start, markup.indexOf('</section>', start)));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('gives the next deadline still open, not one already gone', () => {
    const band = intakesOf(render(lakeside(['2026-09-15', '2026-10-15', '2026-11-15'])));
    expect(band).toContain('Next deadline');
    expect(band).toContain('15 October 2026');
    expect(band).not.toContain('15 September 2026');
    expect(band).not.toContain('(passed)');
  });

  it('says a deadline has passed when every one in the intake has', () => {
    const band = intakesOf(render(lakeside(['2026-09-15', '2026-08-01'])));
    expect(band).toContain('Last deadline');
    expect(band).toContain('15 September 2026 (passed)');
    expect(band).not.toContain('Next deadline');
  });

  it('names the courses’ own intakes in the snapshot, as the band and the questions do', () => {
    const markup = render(lakeside(['2026-11-15']));
    expect(snapshotOf(markup)).toContain('Intakes</span><b>January · May</b>');
    expect(snapshotOf(markup)).not.toContain('April · October');
    expect(plain(markup)).toContain('Its courses list intakes in January and May.');
  });

  it('says whose months they are when it can only give the destination’s', () => {
    const snapshot = snapshotOf(render(university()));
    expect(snapshot).toContain('Main intakes in Germany</span><b>April · October</b>');
  });
});

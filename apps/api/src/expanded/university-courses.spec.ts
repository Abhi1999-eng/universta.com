import {
  courseDeadlines,
  courseFacets,
  durationBands,
  matchesCourseQuery,
  nextDeadline,
  parseCourseQuery,
  relatedOfferings,
  sortOfferings,
  type OfferingLike,
} from './university-courses';

/**
 * A university's own course list, as the behaviour reference runs it: a
 * search box and six filters, each option counted over every course the
 * university publishes, and a sort whose default files courses by study
 * level and then by name.
 */

const UG = { code: 'UG', name: "Bachelor's", educationOrder: 4 };
const PG = { code: 'PG', name: "Master's", educationOrder: 6 };
const PHD = { code: 'PHD', name: 'PhD', educationOrder: 8 };
const computing = { name: 'Computer Science', slug: 'computer-science' };
const business = { name: 'Business', slug: 'business' };
const ai = { name: 'Artificial Intelligence', slug: 'artificial-intelligence' };
const september = {
  name: 'September',
  slug: 'september',
  startMonth: 9,
  endMonth: 9,
};
const january = {
  name: 'January',
  slug: 'january',
  startMonth: 1,
  endMonth: 1,
};

function course(over: Partial<OfferingLike> & { name: string }): OfferingLike {
  return {
    slug: over.name.toLowerCase().replace(/\W+/g, '-'),
    genericCourse: { subject: computing, courseLevel: PG },
    ...over,
  };
}

const catalogue: OfferingLike[] = [
  course({
    name: 'MSc Computer Science',
    courseLevel: PG,
    durationMin: '1',
    durationMax: '2',
    durationUnit: 'YEARS',
    studyMode: 'FULL_TIME',
    tuitionMin: '30000',
    intakes: [{ intake: september, deadline: '2027-06-30' }],
    genericCourse: { subject: computing, subSubject: ai, courseLevel: PG },
  }),
  course({
    name: 'BSc Computer Science',
    courseLevel: UG,
    durationMin: '3',
    durationUnit: 'YEARS',
    studyMode: 'FULL_TIME',
    tuitionMin: '22000',
    intakes: [
      { intake: september, deadline: '2027-01-15' },
      { intake: january, deadline: '2026-09-01' },
    ],
  }),
  course({
    name: 'BA Business',
    courseLevel: null,
    studyMode: 'PART_TIME',
    genericCourse: {
      subject: business,
      courseLevel: UG,
      durationMin: '36',
      durationUnit: 'MONTHS',
    },
    _count: { scholarships: 2 },
  }),
  course({
    name: 'PhD Computing',
    courseLevel: PHD,
    durationMin: '3',
    durationMax: '4',
    durationUnit: 'YEARS',
  }),
];

const today = new Date('2026-10-05T10:00:00Z');

describe('reading the filters a request asks for', () => {
  it('takes several values per filter, as a list or repeated', () => {
    const query = parseCourseQuery({
      level: 'UG,PG',
      subject: ['computer-science', 'business'],
    });
    expect(query.levels).toEqual(['UG', 'PG']);
    expect(query.subjects).toEqual(['computer-science', 'business']);
  });

  it('still reads the names links carried before the list was rebuilt', () => {
    const query = parseCourseQuery({
      courseLevel: 'PG',
      subSubject: 'artificial-intelligence',
      scholarshipAvailable: 'true',
    });
    expect(query.levels).toEqual(['PG']);
    expect(query.specializations).toEqual(['artificial-intelligence']);
    expect(query.scholarship).toBe(true);
  });

  it('falls back to relevance for a sort it does not know', () => {
    expect(parseCourseQuery({ sort: 'cheapest' }).sort).toBe('relevance');
    expect(parseCourseQuery({ sort: 'fee' }).sort).toBe('fee');
  });

  it('drops a duration band that is not one of the three', () => {
    expect(parseCourseQuery({ duration: '12,99' }).durations).toEqual(['12']);
  });
});

describe('narrowing the list', () => {
  const run = (query: Record<string, string>) =>
    catalogue
      .filter((row) => matchesCourseQuery(row, parseCourseQuery(query)))
      .map((row) => row.name);

  it('searches the name, the subject and the level, ignoring case and accents', () => {
    expect(run({ q: 'business' })).toEqual(['BA Business']);
    /* The PhD is filed under Computer Science, so its subject answers too. */
    expect(run({ q: 'COMPUTER sci' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
      'PhD Computing',
    ]);
    expect(run({ q: 'cómputer science msc' })).toEqual([
      'MSc Computer Science',
    ]);
    expect(run({ q: 'artificial' })).toEqual(['MSc Computer Science']);
    expect(run({ q: 'phd' })).toEqual(['PhD Computing']);
  });

  it('files a course under its own level, or its course’s when it has none', () => {
    expect(run({ level: 'UG' })).toEqual([
      'BSc Computer Science',
      'BA Business',
    ]);
    expect(run({ level: 'PG,PHD' })).toEqual([
      'MSc Computer Science',
      'PhD Computing',
    ]);
  });

  it('narrows by subject, specialization, intake, study mode and funding', () => {
    expect(run({ subject: 'business' })).toEqual(['BA Business']);
    expect(run({ specialization: 'artificial-intelligence' })).toEqual([
      'MSc Computer Science',
    ]);
    expect(run({ intake: 'january' })).toEqual(['BSc Computer Science']);
    expect(run({ studyMode: 'PART_TIME' })).toEqual(['BA Business']);
    expect(run({ scholarship: 'true' })).toEqual(['BA Business']);
  });

  it('counts a one-to-two-year course under both bands it touches', () => {
    expect(run({ duration: '12' })).toEqual(['MSc Computer Science']);
    expect(run({ duration: '24' })).toEqual(['MSc Computer Science']);
    expect(run({ duration: '25' })).toEqual([
      'BSc Computer Science',
      'BA Business',
      'PhD Computing',
    ]);
  });

  it('measures a duration in the unit it was given, from the course when the offering is silent', () => {
    expect(durationBands(catalogue[2])).toEqual(['25']);
    expect(
      durationBands(course({ name: 'No unit', durationMin: '2' })),
    ).toEqual([]);
  });

  it('keeps a course with no stated fee inside a tuition bound', () => {
    expect(run({ tuitionMax: '25000' })).toEqual([
      'BSc Computer Science',
      'BA Business',
      'PhD Computing',
    ]);
  });
});

describe('ordering the list', () => {
  const names = (sort: string) =>
    sortOfferings(catalogue, parseCourseQuery({ sort }).sort, today).map(
      (row) => row.name,
    );

  it('runs by study level in academic order, then by name, by default', () => {
    expect(names('')).toEqual([
      'BA Business',
      'BSc Computer Science',
      'MSc Computer Science',
      'PhD Computing',
    ]);
  });

  it('puts a missing fee, deadline or duration last rather than first', () => {
    expect(names('fee')).toEqual([
      'BSc Computer Science',
      'MSc Computer Science',
      'BA Business',
      'PhD Computing',
    ]);
    expect(names('deadline')).toEqual([
      'BSc Computer Science',
      'MSc Computer Science',
      'BA Business',
      'PhD Computing',
    ]);
    expect(names('duration')[0]).toBe('MSc Computer Science');
  });

  it('reads the next deadline that has not passed', () => {
    expect(nextDeadline(catalogue[1], today)?.toISOString().slice(0, 10)).toBe(
      '2027-01-15',
    );
  });
});

describe('counting the choices', () => {
  const facets = courseFacets(catalogue);

  it('counts every option over the whole catalogue, levels in academic order', () => {
    expect(facets.levels.map((o) => [o.value, o.count])).toEqual([
      ['UG', 2],
      ['PG', 1],
      ['PHD', 1],
    ]);
    expect(facets.subjects.map((o) => [o.value, o.count])).toEqual([
      ['computer-science', 3],
      ['business', 1],
    ]);
    expect(facets.specializations).toEqual([
      {
        value: 'artificial-intelligence',
        label: 'Artificial Intelligence',
        subject: 'computer-science',
        count: 1,
      },
    ]);
  });

  it('offers only the duration bands and intakes something answers to', () => {
    expect(facets.durations.map((o) => [o.value, o.count])).toEqual([
      ['12', 1],
      ['24', 1],
      ['25', 3],
    ]);
    expect(facets.intakes.map((o) => [o.value, o.count])).toEqual([
      ['january', 1],
      ['september', 2],
    ]);
    expect(facets.studyModes.map((o) => o.label)).toEqual([
      'Full time',
      'Part time',
    ]);
  });

  it('lists each intake deadline once, with the courses that carry it', () => {
    expect(
      courseDeadlines(catalogue).map((row) => [row.intake.slug, row.deadline]),
    ).toEqual([
      ['january', '2026-09-01'],
      ['september', '2027-01-15'],
      ['september', '2027-06-30'],
    ]);
  });
});

describe('what a course page offers next', () => {
  it('puts the same subject here first, the same specialization at the top, then the subject elsewhere', () => {
    const current = catalogue[0];
    const aiHere = course({
      name: 'BSc Artificial Intelligence',
      courseLevel: UG,
      genericCourse: { subject: computing, subSubject: ai },
    });
    const york = course({ name: 'MSc Data Science at York' });
    const related = relatedOfferings(current, {
      here: [...catalogue.slice(1), aiHere],
      elsewhere: [york],
    });
    expect(related.map((row) => row.name)).toEqual([
      'BSc Artificial Intelligence',
      'BSc Computer Science',
      'PhD Computing',
      'MSc Data Science at York',
    ]);
  });

  it('never offers the course itself, nor what the page already shows, and stops at the limit', () => {
    const leeds = course({ name: 'MSc Computer Science at Leeds' });
    const related = relatedOfferings(
      catalogue[1],
      { here: catalogue, elsewhere: [leeds] },
      ['phd-computing', leeds.slug],
    );
    expect(related.map((row) => row.name)).toEqual(['MSc Computer Science']);
    expect(
      relatedOfferings(catalogue[1], { here: catalogue, elsewhere: [] }, [], 1),
    ).toHaveLength(1);
  });
});

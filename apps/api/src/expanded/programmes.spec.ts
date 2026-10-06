import {
  applicationStatus,
  englishScoreMatch,
  matchesProgramme,
  nameChoices,
  parseProgrammeQuery,
  programmeFacets,
  programmeScope,
  programmeSummary,
  unnamedChoices,
  type ProgrammeRow,
} from './programmes';
import { sortOfferings } from './university-courses';

/**
 * The course finder, as the behaviour reference runs it: every programme at
 * every university, searched and narrowed by the reference's own parameter
 * names as well as this site's older ones, each option counted over the
 * whole catalogue except the University and City lists, which follow the
 * countries chosen. An address that asks for something nothing can answer
 * is answered without it, and says so.
 */

const UG = { code: 'UG', name: "Bachelor's", educationOrder: 4 };
const PG = { code: 'PG', name: "Master's", educationOrder: 6 };
const LEVELS = ['UG', 'PG', 'MBA', 'PHD'];
const computing = { name: 'Computer Science', slug: 'computer-science' };
const software = { name: 'Software Engineering', slug: 'software-engineering' };
const september = { name: 'September', slug: 'september', startMonth: 9 };
const january = { name: 'January', slug: 'january', startMonth: 1 };
const uk = {
  name: 'United Kingdom',
  slug: 'united-kingdom',
  iso2Code: 'GB',
  postStudyWork: true,
};
const japan = {
  name: 'Japan',
  slug: 'japan',
  iso2Code: 'JP',
  postStudyWork: false,
};

const university = (
  name: string,
  country: typeof uk,
  city: string | null,
): ProgrammeRow['university'] => ({
  name,
  slug: name.toLowerCase().replace(/\W+/g, '-'),
  country,
  campuses: [{ city }],
});
const warwick = university('University of Warwick', uk, 'Coventry');
const ucl = university('University College London', uk, 'London');
const tokyo = university('University of Tokyo', japan, 'Tokyo');

let id = 0;
function programme(
  over: Partial<ProgrammeRow> & { name: string },
): ProgrammeRow {
  id += 1;
  return {
    id: `o${id}`,
    slug: `${over.name.toLowerCase().replace(/\W+/g, '-')}-${id}`,
    university: warwick,
    genericCourse: {
      slug: 'msc-computer-science',
      name: 'MSc Computer Science',
      subject: computing,
      courseLevel: PG,
    },
    ...over,
  };
}

const ielts = (score: string | null) => ({
  category: 'ENGLISH_TEST',
  title: 'IELTS Academic',
  minimumScore: score,
});

const catalogue: ProgrammeRow[] = [
  programme({
    name: 'MSc Computer Science',
    courseLevel: PG,
    studyMode: 'FULL_TIME',
    tuitionMin: '30000',
    currencyCode: 'GBP',
    requirements: [ielts('6.5')],
    intakes: [{ intake: september, deadline: '2027-06-30' }],
    genericCourse: {
      slug: 'msc-computer-science',
      name: 'MSc Computer Science',
      subject: computing,
      subSubject: software,
      courseLevel: PG,
    },
  }),
  programme({
    name: 'BSc Computer Science',
    courseLevel: UG,
    studyMode: 'PART_TIME',
    tuitionMin: '22000',
    currencyCode: 'GBP',
    university: ucl,
    requirements: [ielts('7')],
    intakes: [{ intake: january, deadline: '2026-01-15' }],
    genericCourse: {
      slug: 'bsc-computer-science',
      name: 'BSc Computer Science',
      subject: computing,
      courseLevel: UG,
    },
  }),
  programme({
    name: 'MSc Robotics',
    courseLevel: PG,
    university: tokyo,
    /* Filed as an English test with a placeholder title: it names no
       test, so no test filter can read it. */
    requirements: [
      { category: 'ENGLISH_TEST', title: 'Placeholder', minimumScore: '5' },
    ],
    intakes: [{ intake: september, deadline: null }],
    _count: { scholarships: 1 },
  }),
];

const today = new Date('2026-10-05T10:00:00Z');
const parse = (query: Record<string, string | string[]>) =>
  parseProgrammeQuery(query, { levels: LEVELS });
const run = (query: Record<string, string | string[]>) =>
  catalogue
    .filter((row) => matchesProgramme(row, parse(query), today))
    .map((row) => row.name);

describe('reading the reference’s addresses and the site’s old ones', () => {
  it('reads the reference’s level words as level codes', () => {
    expect(parse({ level: 'masters' }).levels).toEqual(['PG']);
    expect(parse({ level: 'undergraduate,phd,mba' }).levels).toEqual([
      'UG',
      'PHD',
      'MBA',
    ]);
    expect(parse({ courseLevel: 'pg' }).levels).toEqual(['PG']);
    expect(run({ level: 'masters' })).toEqual(run({ level: 'PG' }));
  });

  /* "Postgraduate" spans several of our levels and "short course" is none
     of them; guessing would list the wrong programmes. */
  it('leaves out level words it cannot map, and says so', () => {
    const query = parse({ level: 'postgraduate,short-course,PG' });
    expect(query.levels).toEqual(['PG']);
    expect(query.ignored).toEqual(['level=postgraduate', 'level=short-course']);
  });

  it('reads specialization and subSubject, study_mode and pg as the same filters', () => {
    expect(run({ specialization: 'software-engineering' })).toEqual(
      run({ subSubject: 'software-engineering' }),
    );
    expect(parse({ study_mode: 'full-time' }).studyModes).toEqual([
      'FULL_TIME',
    ]);
    expect(run({ study_mode: 'full-time' })).toEqual(['MSc Computer Science']);
    expect(parse({ pg: '3' }).page).toBe(3);
    expect(parse({ page: '2', pg: '3' }).page).toBe(2);
  });

  it('reads the reference’s sort names and the course list’s old ones', () => {
    expect(parse({ sort: 'title' }).sort).toBe('name');
    expect(parse({ sort: 'featured' }).sort).toBe('relevance');
    expect(parse({ sort: 'tuition-low', country: 'united-kingdom' }).sort).toBe(
      'fee',
    );
    expect(parse({ sort: 'newest' }).sort).toBe('newest');
  });

  it('reads an intake as a month number as well as by name', () => {
    const query = parse({ intake: '9,january' });
    expect(query.intakeMonths).toEqual([9]);
    expect(query.intakes).toEqual(['january']);
    expect(run({ intake: '9' })).toEqual([
      'MSc Computer Science',
      'MSc Robotics',
    ]);
    expect(run({ intake: '9,january' })).toHaveLength(3);
  });

  it('answers without what it does not know, and lists what it left out', () => {
    const query = parse({
      sort: 'bogus',
      level: 'nope',
      pageSize: '500',
      duration: '99',
      intake: '13',
      englishTest: 'DUOLINGO',
      ielts: '12',
      status: 'maybe',
      scholarship: 'yes',
      within: 'galaxy',
      delivery: 'online',
      page: 'two',
    });
    expect(query.sort).toBe('relevance');
    expect(query.levels).toEqual([]);
    expect(query.limit).toBe(18);
    expect(query.page).toBe(1);
    expect(query.ignored).toEqual(
      expect.arrayContaining([
        'sort=bogus',
        'level=nope',
        'pageSize=500',
        'duration=99',
        'intake=13',
        'englishTest=DUOLINGO',
        'ielts=12',
        'status=maybe',
        'scholarship=yes',
        'within=galaxy',
        'delivery=online',
        'page=two',
      ]),
    );
  });

  /* A study mode is one of the catalogue's codes, as a level is: one it
     does not have can never match, and kept, it narrowed the list to
     nothing under a chip that read "NOPE". */
  it('leaves out a study mode the catalogue has no code for, and says so', () => {
    const modes = { levels: LEVELS, studyModes: ['FULL_TIME', 'PART_TIME'] };
    const query = parseProgrammeQuery(
      { studyMode: 'nope,PART_TIME', study_mode: 'full-time' },
      modes,
    );
    expect(query.studyModes).toEqual(['PART_TIME', 'FULL_TIME']);
    expect(query.ignored).toEqual(['studyMode=nope']);
    const unknown = parseProgrammeQuery({ studyMode: 'nope' }, modes);
    expect(unknown.studyModes).toEqual([]);
    expect(
      catalogue.filter((row) => matchesProgramme(row, unknown, today)),
    ).toHaveLength(3);
  });

  /* A slug that matches nothing is a question whose answer is none, as on
     the reference, not something to drop. */
  it('narrows to nothing for a slug nothing carries', () => {
    expect(parse({ country: 'atlantis' }).ignored).toEqual([]);
    expect(run({ country: 'atlantis' })).toEqual([]);
    expect(run({ university: 'nowhere' })).toEqual([]);
    expect(run({ course: 'nothing' })).toEqual([]);
  });

  it('accepts a page of up to 360, for a reload of a long run', () => {
    expect(parse({ limit: '360' }).limit).toBe(360);
    expect(parse({ limit: '361' }).ignored).toEqual(['limit=361']);
  });
});

describe('narrowing across universities', () => {
  it('narrows by country, university, city and course', () => {
    expect(run({ country: 'united-kingdom' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
    ]);
    expect(
      run({
        country: 'japan,united-kingdom',
        university: 'university-of-tokyo',
      }),
    ).toEqual(['MSc Robotics']);
    expect(run({ city: 'london' })).toEqual(['BSc Computer Science']);
    expect(run({ city: 'coventry,tokyo' })).toEqual([
      'MSc Computer Science',
      'MSc Robotics',
    ]);
    expect(run({ course: 'bsc-computer-science' })).toEqual([
      'BSc Computer Science',
    ]);
  });

  it('finds a programme by its university, country or city', () => {
    expect(run({ q: 'warwick' })).toEqual(['MSc Computer Science']);
    expect(run({ q: 'japan' })).toEqual(['MSc Robotics']);
    expect(run({ q: 'london' })).toEqual(['BSc Computer Science']);
  });

  it('reads post-study work from the country the programme is taught in', () => {
    expect(run({ postStudyWorkAvailable: 'true' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
    ]);
    expect(run({ scholarship: 'true' })).toEqual(['MSc Robotics']);
  });
});

describe('application status, from recorded deadlines only', () => {
  it('is open while a recorded deadline is ahead and closed once all have passed', () => {
    expect(applicationStatus(catalogue[0], today)).toBe('open');
    expect(applicationStatus(catalogue[1], today)).toBe('closed');
  });

  it('is neither for a programme with no recorded deadline', () => {
    expect(applicationStatus(catalogue[2], today)).toBeNull();
    expect(run({ status: 'open' })).toEqual(['MSc Computer Science']);
    expect(run({ status: 'closed' })).toEqual(['BSc Computer Science']);
    /* Both ticked is every programme with a recorded deadline. */
    expect(run({ status: 'open,closed' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
    ]);
  });
});

describe('English scores', () => {
  it('matches a programme whose listed minimum is at or below the score', () => {
    expect(run({ ielts: '6' })).toEqual([]);
    expect(run({ ielts: '6.5' })).toEqual(['MSc Computer Science']);
    expect(run({ ielts: '7.5' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
    ]);
  });

  it('leaves out a programme that lists no minimum for the test', () => {
    expect(englishScoreMatch(catalogue[2], 'IELTS', 9)).toBe(false);
    const unscored = programme({
      name: 'MA Unscored',
      requirements: [ielts(null)],
    });
    expect(englishScoreMatch(unscored, 'IELTS', 9)).toBe(false);
    expect(run({ toefl: '110' })).toEqual([]);
  });

  it('filters by a test being listed at all', () => {
    expect(run({ englishTest: 'ielts' })).toEqual([
      'MSc Computer Science',
      'BSc Computer Science',
    ]);
  });
});

describe('fees, inside one country only', () => {
  it('applies tuition bounds and the fee sort with exactly one country', () => {
    const one = parse({
      country: 'united-kingdom',
      tuitionMax: '25000',
      sort: 'fee',
    });
    expect(one.tuitionMax).toBe(25000);
    expect(one.sort).toBe('fee');
    expect(run({ country: 'united-kingdom', maxTuition: '25000' })).toEqual([
      'BSc Computer Science',
    ]);
    expect(
      sortOfferings(
        catalogue.filter((row) => matchesProgramme(row, one, today)),
        'fee',
      ).map((row) => row.name),
    ).toEqual(['BSc Computer Science']);
  });

  /* Pounds and yen do not compare, and nothing here converts them. */
  it('ignores them, and says so, across several countries or none', () => {
    const none = parse({ tuitionMin: '1000', sort: 'fee' });
    expect(none.tuitionMin).toBeNull();
    expect(none.sort).toBe('relevance');
    expect(none.ignored).toEqual(['sort=fee', 'tuitionMin=1000']);
    const two = parse({
      country: 'united-kingdom,japan',
      sort: 'tuition-low',
    });
    expect(two.sort).toBe('relevance');
    expect(two.ignored).toEqual(['sort=tuition-low']);
  });
});

describe('counting the choices', () => {
  it('counts levels over the whole catalogue, whatever is chosen', () => {
    const all = programmeFacets(catalogue, parse({}), today);
    const chosen = programmeFacets(
      catalogue,
      parse({ country: 'japan', level: 'UG' }),
      today,
    );
    expect(chosen.levels).toEqual(all.levels);
    expect(chosen.countries).toEqual(all.countries);
    expect(all.countries.map((o) => [o.value, o.count])).toEqual([
      ['japan', 1],
      ['united-kingdom', 2],
    ]);
  });

  it('narrows the University and City lists to the countries chosen', () => {
    const all = programmeFacets(catalogue, parse({}), today);
    expect(all.universities.map((o) => o.value)).toHaveLength(3);
    const facets = programmeFacets(
      catalogue,
      parse({ country: 'united-kingdom' }),
      today,
    );
    expect(facets.universities.map((o) => [o.value, o.count])).toEqual([
      ['university-college-london', 1],
      ['university-of-warwick', 1],
    ]);
    expect(facets.cities.map((o) => [o.value, o.label])).toEqual([
      ['coventry', 'Coventry'],
      ['london', 'London'],
    ]);
  });

  it('counts tests, statuses and extras, and names only the chosen courses', () => {
    const facets = programmeFacets(
      catalogue,
      parse({ course: 'bsc-computer-science' }),
      today,
    );
    expect(facets.englishTests).toEqual([
      { value: 'IELTS', label: 'IELTS', count: 2 },
    ]);
    expect(facets.status.map((o) => [o.value, o.count])).toEqual([
      ['open', 1],
      ['closed', 1],
    ]);
    expect(facets.extras.map((o) => [o.value, o.count])).toEqual([
      ['scholarship', 1],
      ['postStudyWork', 2],
    ]);
    expect(facets.courses).toEqual([
      {
        value: 'bsc-computer-science',
        label: 'BSc Computer Science',
        count: 1,
      },
    ]);
    expect(facets.tuition).toBeNull();
  });

  /* A destination, subject or course nothing is listed under has no count
     to be named by; its chip read "hong-kong" or "ba-law-15". Named from
     the catalogue, with a count of none -- and only those the catalogue
     publishes, so a typed slug stays as typed. */
  it('names a choice nothing is listed under from the catalogue, with a count of none', () => {
    const query = parse({
      country: 'hong-kong,japan,atlantis',
      subject: 'law',
      course: 'ba-law-15,bsc-computer-science',
    });
    const facets = programmeFacets(catalogue, query, today);
    expect(unnamedChoices(facets, query)).toEqual({
      countries: ['hong-kong', 'atlantis'],
      subjects: ['law'],
      courses: ['ba-law-15'],
    });
    const named = nameChoices(facets, {
      countries: [{ name: 'Hong Kong', slug: 'hong-kong', iso2Code: 'HK' }],
      subjects: [{ name: 'Law', slug: 'law' }],
      courses: [{ name: 'BA Law', slug: 'ba-law-15' }],
    });
    expect(named.countries).toEqual([
      { value: 'hong-kong', label: 'Hong Kong', iso2Code: 'HK', count: 0 },
      { value: 'japan', label: 'Japan', iso2Code: 'JP', count: 1 },
      {
        value: 'united-kingdom',
        label: 'United Kingdom',
        iso2Code: 'GB',
        count: 2,
      },
    ]);
    expect(named.subjects.at(-1)).toEqual({
      value: 'law',
      label: 'Law',
      count: 0,
    });
    expect(named.courses).toEqual([
      { value: 'ba-law-15', label: 'BA Law', count: 0 },
      {
        value: 'bsc-computer-science',
        label: 'BSc Computer Science',
        count: 1,
      },
    ]);
    expect(unnamedChoices(named, query)).toEqual({
      countries: ['atlantis'],
      subjects: [],
      courses: [],
    });
    /* An option the counts already name is not named twice. */
    expect(
      nameChoices(named, {
        countries: [{ name: 'Nippon', slug: 'japan' }],
      }).countries.filter((option) => option.value === 'japan'),
    ).toEqual([{ value: 'japan', label: 'Japan', iso2Code: 'JP', count: 1 }]);
  });

  it('offers the tuition range in the one country’s currency', () => {
    const facets = programmeFacets(
      catalogue,
      parse({ country: 'united-kingdom' }),
      today,
    );
    expect(facets.tuition).toEqual({ currencyCode: 'GBP', count: 2 });
  });

  it('sums up programmes, universities, cities, intake months and countries', () => {
    expect(programmeSummary(catalogue)).toEqual({
      programmes: 3,
      universities: 3,
      cities: 3,
      intakeMonths: 2,
      countries: 2,
    });
  });
});

describe('a list fixed to part of the catalogue', () => {
  it('keeps only the filters named in `within`', () => {
    const query = parse({
      country: 'united-kingdom',
      subject: 'computer-science',
      level: 'UG',
      q: 'warwick',
      within: 'country,subject',
    });
    const scope = programmeScope(query);
    expect(scope.countries).toEqual(['united-kingdom']);
    expect(scope.subjects).toEqual(['computer-science']);
    expect(scope.levels).toEqual([]);
    expect(scope.q).toBe('');
    expect(
      catalogue
        .filter((row) => matchesProgramme(row, scope, today))
        .map((row) => row.name),
    ).toEqual(['MSc Computer Science', 'BSc Computer Science']);
  });
});

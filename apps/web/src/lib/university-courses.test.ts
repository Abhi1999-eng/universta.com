import { describe, expect, it } from 'vitest';
import {
  activeChips,
  activeFilterCount,
  courseApiParams,
  courseListSearch,
  courseRunMeta,
  courseRunParams,
  dateLabel,
  durationText,
  isNarrowedCourseList,
  offeringCanonical,
  programmeName,
  readCourseFilters,
  toCourseFacets,
  toOfferingCard,
  toProgrammeList,
  toProgrammeSummary,
  tuitionText,
  withoutScope,
  withQuery,
} from './university-courses';

/**
 * A university's course list keeps its filters in the address, the way the
 * behaviour reference does, so a filtered list can be shared and the back
 * button works. One spelling per list, the old filter names still read, and
 * a chip per filter that removes only itself.
 */

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };

describe('which addresses are a slice of the list', () => {
  it('keeps searched, filtered, sorted and further-loaded views out of the index', () => {
    for (const query of [
      { q: 'msc' },
      { level: 'PG' },
      { subject: 'computer-science' },
      { specialization: 'artificial-intelligence' },
      { duration: '1' },
      { intake: 'september' },
      { studyMode: 'FULL_TIME' },
      { scholarship: 'true' },
      { sort: 'fee' },
      { page: '2' },
      /* The old list's names, which still narrow. */
      { courseLevel: 'UG' },
      { subSubject: 'ai' },
    ])
      expect(isNarrowedCourseList(query)).toBe(true);
  });

  it('treats the bare list under another spelling as the bare list', () => {
    for (const query of [{}, { sort: 'relevance' }, { page: '1' }, { utm_source: 'mail' }, { q: '  ' }])
      expect(isNarrowedCourseList(query)).toBe(false);
  });
});

describe('a date on a university’s pages', () => {
  it('is written in full, the British way, the same on the server and in the browser', () => {
    expect(dateLabel('2027-08-02')).toBe('2 August 2027');
    expect(dateLabel('2026-10-05T23:30:00.000Z')).toBe('5 October 2026');
    expect(dateLabel(null)).toBeNull();
    expect(dateLabel('not a date')).toBeNull();
  });
});

describe('the list’s address', () => {
  it('reads several values per filter, and the names the old list used', () => {
    const filters = readCourseFilters({
      courseLevel: 'PG',
      level: 'UG',
      subSubject: 'artificial-intelligence',
      subject: ['computer-science', 'law'],
      scholarshipAvailable: 'true',
      page: '3',
      sort: 'fee',
    });
    expect(filters.level).toEqual(['UG', 'PG']);
    expect(filters.specialization).toEqual(['artificial-intelligence']);
    expect(filters.subject).toEqual(['computer-science', 'law']);
    expect(filters.scholarship).toBe(true);
    expect(filters.page).toBe(3);
    expect(filters.sort).toBe('fee');
  });

  it('ignores a sort it does not offer and a page that is not one', () => {
    const filters = readCourseFilters(
      new URLSearchParams('sort=cheapest&page=-2'),
    );
    expect(filters.sort).toBe('relevance');
    expect(filters.page).toBe(1);
  });

  it('writes one canonical spelling: commas, no default sort, no first page', () => {
    const filters = readCourseFilters({ level: 'UG', subject: 'law' });
    expect(courseListSearch(filters)).toBe('?level=UG&subject=law');
    expect(courseListSearch(filters, { sort: 'name', level: ['UG', 'PG'] })).toBe(
      '?level=UG%2CPG&subject=law&sort=name',
    );
    expect(courseListSearch(filters, { page: 2 })).toBe(
      '?level=UG&subject=law&page=2',
    );
    expect(courseListSearch(readCourseFilters({}))).toBe('');
  });

  it('asks the API for eighteen at a time, under the API’s names', () => {
    const params = courseApiParams(
      readCourseFilters({ q: ' data ', scholarship: 'true', sort: 'duration' }),
      2,
    );
    expect(params).toEqual({
      limit: '18',
      page: '2',
      q: 'data',
      scholarshipAvailable: 'true',
      sort: 'duration',
    });
  });

  it('reads ?page=N as the first N pages, the way “Load more” leaves it', () => {
    const filters = readCourseFilters({ level: 'PG', page: '3' });
    expect(courseRunParams(filters)).toEqual({ limit: '54', page: '1', level: 'PG' });
    /* "Load more" itself still asks for the one page after. */
    expect(courseApiParams(filters, 4)).toMatchObject({ limit: '18', page: '4' });
    expect(courseRunMeta({ page: 1, limit: 54, total: 40, totalPages: 1 }, filters)).toEqual({
      page: 3,
      limit: 18,
      total: 40,
      totalPages: 3,
    });
    /* An address that asks for more pages than there are shows them all. */
    expect(
      courseRunMeta({ total: 20 }, readCourseFilters({ page: '9' })).page,
    ).toBe(2);
    expect(courseRunMeta(undefined, readCourseFilters({})).page).toBe(1);
  });

  it('gives each filter in force a chip that removes only that one', () => {
    const filters = readCourseFilters({
      q: 'data',
      level: 'UG,PG',
      sort: 'fee',
    });
    const facets = toCourseFacets({
      levels: [
        { value: 'UG', label: "Bachelor's", count: 4 },
        { value: 'PG', label: "Master's", count: 2 },
      ],
    });
    const chips = activeChips(filters, facets);
    expect(chips.map((chip) => chip.label)).toEqual([
      '“data”',
      "Bachelor's",
      "Master's",
    ]);
    expect(chips[1]!.search).toBe('?q=data&level=PG&sort=fee');
    expect(chips[0]!.search).toBe('?level=UG%2CPG&sort=fee');
  });
});

describe('the facets', () => {
  it('labels intakes by their months and study modes in words', () => {
    const facets = toCourseFacets({
      intakes: [
        { value: 'september', label: 'September', startMonth: 9, endMonth: 9, count: 3 },
      ],
      studyModes: [{ value: 'FULL_TIME', label: 'FULL_TIME', count: 2 }],
    });
    expect(facets.intake).toEqual([
      { value: 'september', label: 'September', count: 3 },
    ]);
    expect(facets.studyMode[0]!.label).toBe('Full time');
    expect(facets.subject).toEqual([]);
  });
});

describe('a course as a card', () => {
  const row = {
    id: 'o1',
    name: 'MSc Computer Science at University of Oxford',
    slug: 'university-of-oxford-msc-computer-science',
    studyMode: 'FULL_TIME',
    durationMin: null,
    tuitionMin: '30000',
    tuitionMax: '30000',
    currencyCode: 'GBP',
    tuitionPeriod: 'PER_YEAR',
    campus: { name: 'Oxford city colleges', city: 'Oxford' },
    genericCourse: {
      qualificationName: 'Master of Science',
      durationMin: '1',
      durationMax: '2',
      durationUnit: 'YEARS',
      subject: { name: 'Computer Science', slug: 'computer-science' },
      subSubject: null,
      courseLevel: { code: 'PG', name: "Master's" },
    },
    intakes: [
      { deadline: '2099-06-30', intake: { name: 'September', startMonth: 9, endMonth: 9 } },
      { deadline: '2000-01-01', intake: { name: 'January', startMonth: 1, endMonth: 1 } },
    ],
  };
  const owner = { name: 'University of Oxford', slug: 'university-of-oxford', country: uk, city: 'Oxford' };

  it('links under the university’s country and drops the university from the name', () => {
    const card = toOfferingCard(row, owner)!;
    expect(card.href).toBe(
      '/study-abroad/united-kingdom/universities/university-of-oxford/courses/university-of-oxford-msc-computer-science',
    );
    expect(card.name).toBe('MSc Computer Science');
    expect(card.university.href).toBe('/universities/university-of-oxford');
    expect(card.university.location).toBe('Oxford, United Kingdom');
  });

  it('reads the facts it has, the course’s duration when the offering states none', () => {
    const card = toOfferingCard(row, owner)!;
    expect(card.duration).toBe('1–2 years');
    expect(card.tuition).toBe('GBP 30,000/yr');
    expect(card.studyMode).toBe('Full time');
    expect(card.level).toEqual({ code: 'PG', name: "Master's" });
    expect(card.intakes).toEqual(['September', 'January']);
    /* "Apply by 30 June 2099": the way the university's profile and the
       course page write the same deadline. */
    expect(card.nextDeadline).toBe('30 June 2099');
  });

  it('takes the university from the row when none is handed over', () => {
    const card = toOfferingCard({
      ...row,
      university: {
        name: 'ETH Zurich',
        slug: 'eth-zurich',
        country: { name: 'Switzerland', slug: 'switzerland', iso2Code: 'CH' },
        campuses: [{ city: null }, { city: 'Zurich' }],
      },
      campus: null,
    })!;
    expect(card.href.startsWith('/study-abroad/switzerland/universities/eth-zurich/courses/')).toBe(true);
    expect(card.university.location).toBe('Zurich, Switzerland');
  });

  it('refuses a row it cannot file under a country', () => {
    expect(toOfferingCard({ ...row, university: { name: 'X', slug: 'x' } })).toBeNull();
  });

  it('says nothing rather than zero for a fee nobody filled in', () => {
    expect(tuitionText({ tuitionMin: '0', tuitionMax: '0' })).toBeNull();
    expect(tuitionText({ tuitionMin: '1000', tuitionMax: '2000', currencyCode: 'EUR' })).toBe(
      'EUR 1,000–2,000',
    );
    expect(durationText({ durationMin: '1', durationUnit: 'YEARS' })).toBe('1 year');
    expect(durationText({ durationMin: '36', durationUnit: 'MONTHS' })).toBe('36 months');
  });

  it('only strips the university’s own name from the end', () => {
    expect(programmeName('BA Law at Leeds', 'Leeds')).toBe('BA Law');
    expect(programmeName('Studies at Leeds Beckett', 'Leeds')).toBe('Studies at Leeds Beckett');
  });

  /* The language is read the way the programme's own page reads it: an
     English requirement means English, with the score as its evidence.
     Without one the card says nothing about language, which reads "Not
     listed" -- never an assumption from the country. */
  it('names its language only from an English requirement, with that evidence', () => {
    const listed = toOfferingCard(
      {
        ...row,
        requirements: [
          { category: 'ACADEMIC', title: 'A levels', minimumScore: null },
          { category: 'ENGLISH_TEST', title: 'IELTS Academic', minimumScore: '6.50' },
          { category: 'ENGLISH_TEST', title: 'Placeholder', minimumScore: '5' },
        ],
      },
      owner,
    )!;
    expect(listed.language).toEqual({
      value: 'English',
      note: 'IELTS Academic 6.5 minimum · Placeholder 5 minimum',
    });
    expect(listed.englishTests).toEqual([
      { test: 'IELTS', title: 'IELTS Academic', minimum: '6.5' },
      { test: null, title: 'Placeholder', minimum: '5' },
    ]);
    const silent = toOfferingCard(row, owner)!;
    expect(silent.language).toBeNull();
    expect(silent.englishTests).toEqual([]);
  });

  it('carries its own id, for a saved list, and the course guide it is an instance of', () => {
    const card = toOfferingCard(
      {
        ...row,
        genericCourse: { ...row.genericCourse, name: 'MSc Computer Science', slug: 'msc-computer-science' },
      },
      owner,
    )!;
    expect(card.offeringId).toBe('o1');
    expect(card.genericCourse).toEqual({ name: 'MSc Computer Science', slug: 'msc-computer-science' });
    expect(toOfferingCard({ ...row, id: undefined }, owner)!.offeringId).toBeNull();
  });
});

describe('the course finder’s address', () => {
  it('reads the reference’s names and words as ours', () => {
    const filters = readCourseFilters({
      level: 'masters,undergraduate',
      specialization: 'software-engineering',
      study_mode: 'full-time',
      pg: '2',
      sort: 'title',
    });
    expect(filters.level).toEqual(['PG', 'UG']);
    expect(filters.studyMode).toEqual(['FULL_TIME']);
    expect(filters.page).toBe(2);
    expect(filters.sort).toBe('name');
    expect(readCourseFilters({ sort: 'tuition-low' }).sort).toBe('fee');
    expect(readCourseFilters({ sort: 'featured' }).sort).toBe('relevance');
    expect(readCourseFilters({ sort: 'newest' }).sort).toBe('newest');
  });

  it('reads the finder’s filters, and the course list’s old names for them', () => {
    const filters = readCourseFilters({
      country: 'united-kingdom',
      university: 'university-of-warwick',
      city: 'coventry,london',
      course: 'msc-computer-science',
      englishTest: 'ielts',
      status: 'open,maybe',
      postStudyWorkAvailable: 'true',
      ielts: '6.5',
      toefl: '500',
      minTuition: '1000',
      maxTuition: 'lots',
    });
    expect(filters.country).toEqual(['united-kingdom']);
    expect(filters.university).toEqual(['university-of-warwick']);
    expect(filters.city).toEqual(['coventry', 'london']);
    expect(filters.course).toEqual(['msc-computer-science']);
    expect(filters.englishTest).toEqual(['IELTS']);
    expect(filters.status).toEqual(['open']);
    expect(filters.postStudyWork).toBe(true);
    expect(filters.ielts).toBe('6.5');
    /* A score no test is marked on, and a fee that is not a number, are
       typos rather than filters. */
    expect(filters.toefl).toBe('');
    expect(filters.tuitionMin).toBe('1000');
    expect(filters.tuitionMax).toBe('');
  });

  it('writes one canonical spelling for every filter, in the order the address keeps', () => {
    const filters = readCourseFilters({
      sort: 'fee',
      status: 'closed',
      pte: '60',
      scholarshipAvailable: 'true',
      postStudyWorkAvailable: 'true',
      studyMode: 'PART_TIME',
      level: 'PG',
      course: 'mba',
      country: 'japan',
      q: 'data',
      minTuition: '500',
    });
    expect(courseListSearch(filters)).toBe(
      '?q=data&country=japan&course=mba&level=PG&studyMode=PART_TIME&scholarship=true&postStudyWork=true&pte=60&status=closed&tuitionMin=500&sort=fee',
    );
    expect(isNarrowedCourseList({ ielts: '6' })).toBe(true);
    expect(isNarrowedCourseList({ status: 'nope' })).toBe(false);
  });

  it('sends what a list is fixed to, and names it in `within`, without writing it into the address', () => {
    const filters = withoutScope(
      readCourseFilters({ country: 'japan', level: 'PG' }),
      { country: ['united-kingdom'] },
    );
    expect(filters.country).toEqual([]);
    expect(courseListSearch(filters)).toBe('?level=PG');
    expect(
      courseApiParams(filters, 1, { country: ['united-kingdom'], subject: ['law'] }),
    ).toEqual({
      limit: '18',
      page: '1',
      country: 'united-kingdom',
      level: 'PG',
      subject: 'law',
      within: 'country,subject',
    });
    expect(courseRunParams(readCourseFilters({ page: '2' }), { university: ['x'] })).toEqual({
      limit: '36',
      page: '1',
      university: 'x',
      within: 'university',
    });
  });

  it('gives the finder’s filters chips, a slug nothing carries included', () => {
    const filters = readCourseFilters({
      country: 'atlantis',
      course: 'msc-computer-science',
      status: 'open',
      postStudyWork: 'true',
      ielts: '6.5',
      tuitionMax: '20000',
      country2: 'x',
    });
    const facets = toCourseFacets({
      courses: [{ value: 'msc-computer-science', label: 'MSc Computer Science', count: 4 }],
      status: [{ value: 'open', label: 'Upcoming deadline', count: 6 }],
      tuition: { currencyCode: 'GBP', count: 3 },
    });
    expect(activeChips(filters, facets).map((chip) => chip.label)).toEqual([
      'atlantis',
      'MSc Computer Science',
      'Upcoming deadline',
      'Post-study work',
      'IELTS score 6.5',
      'Tuition up to GBP 20,000',
    ]);
    expect(activeFilterCount(filters)).toBe(6);
    expect(activeChips(filters, facets)[0]!.search).toBe(
      '?course=msc-computer-science&postStudyWork=true&ielts=6.5&status=open&tuitionMax=20000',
    );
  });

  it('reads the API’s answer as a results block draws it', () => {
    const list = toProgrammeList(
      {
        data: [
          {
            id: 'o1',
            name: 'MSc Robotics',
            slug: 'tokyo-msc-robotics',
            university: {
              name: 'University of Tokyo',
              slug: 'university-of-tokyo',
              country: { name: 'Japan', slug: 'japan', iso2Code: 'JP' },
            },
          },
        ],
        meta: { page: 1, limit: 18, total: 40, totalPages: 3, sort: 'relevance', ignored: ['sort=fee'] },
        facets: {
          countries: [{ value: 'japan', label: 'Japan', count: 40 }],
          extras: [{ value: 'scholarship', label: 'With scholarships', count: 2 }],
          tuition: null,
        },
        summary: { programmes: 40, universities: 3, cities: 2, intakeMonths: 2, countries: 1 },
      },
      readCourseFilters({}),
    );
    expect(list.cards.map((card) => card.href)).toEqual([
      '/study-abroad/japan/universities/university-of-tokyo/courses/tokyo-msc-robotics',
    ]);
    expect(list.meta).toEqual({ page: 1, limit: 18, total: 40, totalPages: 3 });
    expect(list.facets.country).toEqual([{ value: 'japan', label: 'Japan', count: 40 }]);
    expect(list.facets.extras).toHaveLength(1);
    expect(list.facets.tuition).toBeNull();
    expect(list.summary.programmes).toBe(40);
    expect(list.ignored).toEqual(['sort=fee']);
    expect(toProgrammeSummary(undefined)).toEqual({
      programmes: 0,
      universities: 0,
      cities: 0,
      intakeMonths: 0,
      countries: 0,
    });
  });
});

describe('a redirect’s query', () => {
  it('travels on with the request, campaign tags and filters alike', () => {
    expect(withQuery('/universities/oxford', { utm_source: 'x', level: ['UG', 'PG'] })).toBe(
      '/universities/oxford?utm_source=x&level=UG&level=PG',
    );
    expect(withQuery('/universities/oxford', {})).toBe('/universities/oxford');
    expect(withQuery('/a?b=1#top', { c: '2', d: undefined })).toBe('/a?b=1&c=2#top');
  });
});

describe('the course page’s canonical address', () => {
  const nested = '/study-abroad/uk/universities/oxford/courses/msc';
  it('gives up the old flat default for the nested address', () => {
    expect(offeringCanonical('/universities/oxford/courses/msc', nested)).toBe(nested);
    expect(offeringCanonical(null, nested)).toBe(nested);
  });
  it('keeps an editor’s own choice', () => {
    expect(offeringCanonical('/courses/msc-computer-science', nested)).toBe(
      '/courses/msc-computer-science',
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  activeChips,
  courseApiParams,
  courseListSearch,
  durationText,
  offeringCanonical,
  programmeName,
  readCourseFilters,
  toCourseFacets,
  toOfferingCard,
  tuitionText,
} from './university-courses';

/**
 * A university's course list keeps its filters in the address, the way the
 * behaviour reference does, so a filtered list can be shared and the back
 * button works. One spelling per list, the old filter names still read, and
 * a chip per filter that removes only itself.
 */

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };

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
    expect(card.nextDeadline).toBe('Jun 30, 2099');
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

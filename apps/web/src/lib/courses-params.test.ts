import { describe, expect, it } from 'vitest';
import type { CourseFilterOptions } from './catalog';
import {
  checkGuideFilters,
  chooseView,
  guideApiParams,
  guideListSearch,
  guidesAsProgrammes,
  hasProgrammeOnly,
  isNarrowedCourses,
  NO_GUIDE_FILTERS,
  PROGRAMME_MAX_PAGES,
  readGuideFilters,
  requestedView,
  withoutIgnored,
} from './courses-params';
import { courseListSearch, readCourseFilters } from './university-courses';

/**
 * The address of /courses, read for its two views. A link written for the
 * reference, for the page as it used to be or for either view lands on the
 * same choice in whichever view opens; and nothing in an address can turn
 * the page into an error -- what the guides' API would refuse is checked
 * against the catalogue's own options first.
 */

const options: CourseFilterOptions = {
  levels: [
    { value: 'UG', label: "Bachelor's", count: 83 },
    { value: 'PG', label: "Master's", count: 100 },
  ],
  countries: [
    { value: 'denmark', label: 'Denmark', count: 15, currencyCode: 'DKK' },
    { value: 'united-kingdom', label: 'United Kingdom', count: 53, currencyCode: 'GBP' },
  ],
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
  intakes: [
    { value: 'september', label: 'Sep', count: 162, startMonth: 9, endMonth: 9 },
    { value: 'january', label: 'Jan', count: 152, startMonth: 1, endMonth: 1 },
  ],
  englishTests: [{ value: 'IELTS', label: 'IELTS', count: 12 }],
  extras: [],
  sorts: [
    { value: 'featured', label: 'Recommended' },
    { value: 'name', label: 'Alphabetical' },
  ],
  tuition: { enabled: false, country: null, currencyCode: null },
};

const guides = (raw: Record<string, string>) =>
  checkGuideFilters(readGuideFilters(raw), options);

describe('the address, read for both views', () => {
  it('reads the reference’s names into the programmes and the course guides alike', () => {
    const raw = {
      specialization: 'software-engineering',
      study_mode: 'full-time',
      level: 'masters',
      pg: '2',
      sort: 'title',
    };
    const programmes = readCourseFilters(raw);
    expect(programmes.specialization).toEqual(['software-engineering']);
    expect(programmes.studyMode).toEqual(['FULL_TIME']);
    expect(programmes.level).toEqual(['PG']);
    expect(programmes.page).toBe(2);
    expect(programmes.sort).toBe('name');

    const guide = readGuideFilters(raw);
    expect(guide.subSubject).toEqual(['software-engineering']);
    expect(guide.studyMode).toEqual(['FULL_TIME']);
    expect(guide.level).toEqual(['PG']);
    expect(guide.page).toBe(2);
    expect(guide.sort).toBe('name');
  });

  it('still reads the names the course guides used to write', () => {
    const raw = {
      subSubject: 'software-engineering',
      scholarshipAvailable: 'true',
      postStudyWorkAvailable: 'true',
      minTuition: '1000',
      maxTuition: '9000.50',
      pageSize: '24',
    };
    const guide = readGuideFilters(raw);
    expect(guide.subSubject).toEqual(['software-engineering']);
    expect(guide.scholarshipAvailable).toBe(true);
    expect(guide.postStudyWorkAvailable).toBe(true);
    expect(guide.minTuition).toBe('1000');
    expect(guide.maxTuition).toBe('9000.50');
    expect(guide.pageSize).toBe(24);

    const programmes = readCourseFilters(raw);
    expect(programmes.specialization).toEqual(['software-engineering']);
    expect(programmes.scholarship).toBe(true);
    expect(programmes.tuitionMin).toBe('1000');
  });

  it('drops what the course guides cannot take, without throwing', () => {
    const cases: Array<[Record<string, string>, Record<string, string>]> = [
      [{ sort: 'fee' }, { pageSize: '12' }],
      [{ sort: 'tuition-low' }, { pageSize: '12' }],
      [{ sort: 'bogus' }, { pageSize: '12' }],
      [{ level: 'masters' }, { level: 'PG', pageSize: '12' }],
      [{ level: 'nope' }, { pageSize: '12' }],
      [{ studyMode: 'full-time' }, { studyMode: 'FULL_TIME', pageSize: '12' }],
      [{ studyMode: 'by-owl' }, { pageSize: '12' }],
      [{ englishTest: 'toefl,klingon' }, { englishTest: 'TOEFL', pageSize: '12' }],
      [{ pageSize: '500' }, { pageSize: '100' }],
      [{ pageSize: 'lots' }, { pageSize: '12' }],
      [{ minTuition: '1e3', country: 'denmark' }, { country: 'denmark', pageSize: '12' }],
    ];
    for (const [raw, sent] of cases) {
      expect(() => guides(raw)).not.toThrow();
      expect(guideApiParams(guides(raw).api)).toEqual(sent);
    }
  });

  it('narrows to nothing for a place or a field nothing matches, and keeps it to undo', () => {
    const nowhere: Array<Record<string, string>> = [
      { country: 'atlantis' },
      { subject: 'nope' },
      { specialization: 'nope' },
      { intake: 'smarch' },
    ];
    for (const raw of nowhere) {
      const checked = guides(raw);
      expect(checked.nothing).toBe(true);
      expect(Object.values(checked.unknown).flat()).toEqual([Object.values(raw)[0]]);
    }
    const mixed = guides({ country: 'denmark,atlantis' });
    expect(mixed.nothing).toBe(false);
    expect(mixed.api.country).toEqual(['denmark']);
    expect(mixed.filters.country).toEqual(['denmark', 'atlantis']);
    expect(mixed.unknown).toEqual({ country: ['atlantis'] });
  });

  it('reads an intake given as a month number, as the reference writes it', () => {
    expect(guides({ intake: '9' }).api.intake).toEqual(['september']);
    expect(guides({ intake: '1,september' }).api.intake).toEqual(['january', 'september']);
  });

  it('keeps fees and the fee order only inside one destination', () => {
    const one = guides({ country: 'united-kingdom', sort: 'fee', minTuition: '1000' });
    expect(one.api.sort).toBe('tuition-low');
    expect(one.api.minTuition).toBe('1000');
    const two = guides({ country: 'united-kingdom,denmark', sort: 'fee', minTuition: '1000' });
    expect(two.api.sort).toBe('');
    expect(two.api.minTuition).toBe('');
    const inverted = guides({ country: 'denmark', minTuition: '9000', maxTuition: '10' });
    expect(inverted.api.minTuition).toBe('');
    expect(inverted.api.maxTuition).toBe('');
  });

  it('reads no further than the programmes the API can draw at once', () => {
    expect(PROGRAMME_MAX_PAGES * 18).toBe(360);
  });
});

describe('which view opens', () => {
  it('opens on programmes unless the address asks for the guides', () => {
    expect(requestedView({})).toBeNull();
    expect(requestedView({ view: 'guides' })).toBe('guides');
    expect(requestedView({ view: 'Programmes' })).toBe('programmes');
    expect(requestedView({ view: 'other' })).toBeNull();
    expect(chooseView(null, 1155)).toBe('programmes');
    expect(chooseView('guides', 1155)).toBe('guides');
  });

  it('opens on the course guides when the catalogue has no programme', () => {
    expect(chooseView(null, 0)).toBe('guides');
    expect(chooseView('programmes', 0)).toBe('guides');
  });
});

describe('the addresses the page writes', () => {
  it('leaves the default order out', () => {
    expect(guideListSearch({ ...NO_GUIDE_FILTERS, sort: 'featured' })).toBe('?view=guides');
    expect(guideListSearch(NO_GUIDE_FILTERS, {}, { view: false })).toBe('');
    expect(courseListSearch(readCourseFilters({ sort: 'relevance' }))).toBe('');
    expect(courseListSearch(readCourseFilters({ sort: 'featured' }))).toBe('');
    expect(guideListSearch(readGuideFilters({ sort: 'relevance' }))).toBe('?view=guides');
  });

  it('writes the guides in their own names, one spelling', () => {
    const filters = readGuideFilters({
      specialization: 'software-engineering',
      scholarship: 'true',
      sort: 'title',
      page: '3',
    });
    expect(guideListSearch(filters, { page: filters.page })).toBe(
      '?view=guides&subSubject=software-engineering&scholarshipAvailable=true&sort=name&page=3',
    );
  });

  it('carries the programmes’ own filters through the guides and back, and never to the guides’ API', () => {
    const raw = {
      level: 'PG',
      university: 'university-of-warwick',
      city: 'coventry',
      course: 'ba-law-15',
      status: 'closed',
      ielts: '6',
    };
    const checked = guides(raw);
    expect(checked.filters.programmeOnly).toEqual({
      university: ['university-of-warwick'],
      city: ['coventry'],
      course: ['ba-law-15'],
      duration: [],
      status: ['closed'],
      ielts: '6',
      toefl: '',
      pte: '',
    });
    expect(hasProgrammeOnly(checked.filters.programmeOnly)).toBe(true);
    expect(hasProgrammeOnly(guides({ level: 'PG' }).filters.programmeOnly)).toBe(false);
    /* The guides can apply none of them, so none is asked of their API. */
    expect(guideApiParams(checked.api)).toEqual({ level: 'PG', pageSize: '12' });

    const there = guideListSearch(checked.filters);
    expect(there).toBe(
      '?view=guides&level=PG&university=university-of-warwick&city=coventry&course=ba-law-15&status=closed&ielts=6',
    );
    const back = guidesAsProgrammes(readGuideFilters(Object.fromEntries(new URLSearchParams(there))));
    expect(courseListSearch(readCourseFilters({}), back)).toBe(
      '?university=university-of-warwick&city=coventry&course=ba-law-15&level=PG&ielts=6&status=closed',
    );
    /* Clearing the guides' filters clears what they carried too. */
    expect(guideListSearch(checked.filters, NO_GUIDE_FILTERS)).toBe('?view=guides');
  });

  it('takes out of the programmes’ filters what the API ignored', () => {
    const filters = readCourseFilters({
      level: 'nope,UG',
      sort: 'fee',
      ielts: '6.5',
      specialization: 'software-engineering',
    });
    const kept = withoutIgnored(filters, ['level=nope', 'sort=fee', 'ielts=6.5']);
    expect(kept.level).toEqual(['UG']);
    expect(kept.sort).toBe('relevance');
    expect(kept.ielts).toBe('');
    expect(kept.specialization).toEqual(['software-engineering']);
    expect(withoutIgnored(filters, ['subSubject=software-engineering']).specialization).toEqual([]);
  });
});

describe('what stays out of the index', () => {
  it('indexes the bare page, and nothing narrower', () => {
    expect(isNarrowedCourses({})).toBe(false);
    expect(isNarrowedCourses({ utm_source: 'newsletter' })).toBe(false);
    expect(isNarrowedCourses({ sort: 'relevance' })).toBe(false);
    for (const raw of [
      { country: 'denmark' },
      { q: 'x' },
      { page: '2' },
      { view: 'guides' },
      { sort: 'name' },
      { pageSize: '24' },
      { level: 'nope' },
    ])
      expect(isNarrowedCourses(raw)).toBe(true);
  });
});

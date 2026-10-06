import { describe, expect, it } from 'vitest';
import {
  courseRowFigure,
  courseRowMeta,
  durationLabel,
  levelAnchor,
  levelCoursesHref,
  levelTotal,
  programmesHref,
} from './course-levels';

describe('where a level is', () => {
  it('gives each level a section address made from its code', () => {
    expect(levelAnchor('UG')).toBe('level-ug');
    expect(levelAnchor('PRE_MASTERS')).toBe('level-pre-masters');
  });

  it('sends "all of this level" to the course list, filtered to exactly what the section counted', () => {
    expect(levelCoursesHref({ subject: 'engineering', level: 'PG' })).toBe(
      '/courses?subject=engineering&level=PG&view=guides',
    );
    expect(
      levelCoursesHref({
        subject: 'engineering',
        subSubject: 'civil-engineering',
        country: 'uk',
        level: 'UG',
      }),
    ).toBe(
      '/courses?country=uk&subject=engineering&specialization=civil-engineering&level=UG&view=guides',
    );
    /* Without a level it is the whole subject there. */
    expect(levelCoursesHref({ subject: 'law', country: 'uk' })).toBe(
      '/courses?country=uk&subject=law&view=guides',
    );
  });

  it('opens the course guides, because a level counts courses and the finder opens on programmes', () => {
    /* "Master's (14)" has to open a list of fourteen. */
    expect(
      new URL(levelCoursesHref({ subject: 'computer-science', level: 'PG' }), 'http://x')
        .searchParams.get('view'),
    ).toBe('guides');
  });
});

describe('the finder’s programmes, for a link with no course count', () => {
  it('names a course, a destination, a subject and its specialization in the finder’s own words', () => {
    expect(programmesHref({ course: 'msc-computer-science' })).toBe(
      '/courses?course=msc-computer-science',
    );
    expect(
      programmesHref({ course: 'bsc-computer-science', country: 'united-kingdom' }),
    ).toBe('/courses?course=bsc-computer-science&country=united-kingdom');
    expect(
      programmesHref(
        {
          country: 'united-kingdom',
          subject: 'computer-science',
          specialization: 'software-engineering',
        },
        '#discovery',
      ),
    ).toBe(
      '/courses?country=united-kingdom&subject=computer-science&specialization=software-engineering#discovery',
    );
  });

  it('never opens the guides view, which is for counts of courses', () => {
    expect(programmesHref({ subject: 'law' })).not.toContain('view=');
  });

  it('drops a specialization that comes without its subject, whose slug alone names no one branch', () => {
    expect(programmesHref({ specialization: 'artificial-intelligence' })).toBe('/courses');
  });
});

describe('what one course says in a row', () => {
  const duration = (min: string | null, max: string | null, unit: string | null) => ({
    duration: { min, max, unit },
  });

  it('says a length once, and a range as a range', () => {
    expect(durationLabel(duration('3.00', '3.00', 'YEARS'))).toBe('3 years');
    expect(durationLabel(duration('3.00', '4.00', 'YEARS'))).toBe('3–4 years');
    expect(durationLabel(duration('1.50', null, 'YEARS'))).toBe('1.5 years');
    expect(durationLabel(duration(null, null, 'YEARS'))).toBeNull();
    expect(durationLabel(duration('1.00', '1.00', 'YEARS'))).toBe('1 year');
    expect(durationLabel(duration('1.00', null, 'MONTHS'))).toBe('1 month');
    expect(durationLabel(duration('1.00', '2.00', 'YEARS'))).toBe('1–2 years');
  });

  it('names the specialization, the length and how it is taught -- only what is recorded', () => {
    const course = {
      subSubject: { id: 's', name: 'Civil Engineering', slug: 'civil-engineering' },
      ...duration('3.00', '4.00', 'YEARS'),
      studyModes: [
        { id: 'f', name: 'Full time', code: 'FULL_TIME' },
        { id: 'p', name: 'Part time', code: 'PART_TIME' },
      ],
    };
    expect(courseRowMeta(course)).toBe(
      'Civil Engineering · 3–4 years · Full time / Part time',
    );
    /* On the specialization's own page every row would name the same one. */
    expect(courseRowMeta(course, { branch: false })).toBe(
      '3–4 years · Full time / Part time',
    );
    expect(
      courseRowMeta({ subSubject: null, ...duration(null, null, null), studyModes: [] }),
    ).toBe('');
  });

  it('ends a row with what the destination charges, when one is chosen', () => {
    expect(
      courseRowFigure({
        selectedTuition: { min: '9250.00', max: '12000.00', currencyCode: 'GBP', period: 'YEAR' },
        availableCountryCount: 4,
      }),
    ).toBe('GBP 9,250–12,000');
    expect(
      courseRowFigure({
        selectedTuition: { min: '9250.00', max: '9250.00', currencyCode: 'GBP', period: 'YEAR' },
        availableCountryCount: 4,
      }),
    ).toBe('GBP 9,250');
  });

  it('says nothing about money it does not have, rather than guess or change the subject', () => {
    /* In a destination with no fee recorded: not "4 destinations" in the
       column the other rows use for a fee. */
    expect(
      courseRowFigure({
        selectedTuition: { min: null, max: null, currencyCode: 'GBP', period: 'YEAR' },
        availableCountryCount: 4,
      }),
    ).toBeNull();
  });

  it('ends a row with how many destinations teach it, outside a destination', () => {
    expect(courseRowFigure({ selectedTuition: null, availableCountryCount: 4 })).toBe(
      '4 destinations',
    );
    expect(courseRowFigure({ selectedTuition: null, availableCountryCount: 1 })).toBe(
      '1 destination',
    );
    expect(courseRowFigure({ selectedTuition: null, availableCountryCount: 0 })).toBeNull();
  });
});

describe('the count across levels', () => {
  it('adds the levels up, counting each level whole and not only the rows it sent', () => {
    const group = (count: number) => ({
      level: { id: String(count), code: 'X', name: 'X', educationOrder: 0 },
      count,
      courses: [],
    });
    expect(levelTotal([group(10), group(20)])).toBe(30);
    expect(levelTotal([])).toBe(0);
  });
});

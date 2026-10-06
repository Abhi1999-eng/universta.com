import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The page sits inside the Study Abroad shell (the assessment and the plan
   band open it) and its "Add a course…" list reads the router; both are
   stubbed, and so is the API the route asks. */
vi.mock('./StudyAbroadShell', () => ({
  useStudyAbroadShell: () => ({ openAssessment: () => {}, openSelector: () => {} }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  usePathname: () => '/compare/courses',
  useSearchParams: () => new URLSearchParams(),
}));
const phaseCompare = vi.fn();
const phaseComparisonOptions = vi.fn();
vi.mock('@/lib/phase1', () => ({
  phaseCompare: (...args: unknown[]) => phaseCompare(...args),
  phaseComparisonOptions: (...args: unknown[]) => phaseComparisonOptions(...args),
}));
vi.mock('@/lib/static-page-seo', () => ({ staticPageMetadata: async () => ({}) }));

import { renderToStaticMarkup } from 'react-dom/server';
import CompareCoursesPage from '@/app/(sa)/compare/courses/page';
import {
  compareMarks,
  readCompareSlugs,
  toCompareColumn,
  toCompareOptions,
  withoutSlug,
  type CompareColumn,
} from '@/lib/course-compare';
import { CourseComparePage } from './CourseComparePage';

/**
 * Programmes side by side, in the design's comparison: twelve rows, a
 * Remove under each programme that drops only that one, the lower tuition
 * and the shorter duration marked only where they can honestly be set
 * against each other, and every silence said as "Not listed" or "Check
 * official source". The address reads the reference's `ids` as well as
 * `items`, and a programme the catalogue does not have is named as
 * unavailable rather than dropped.
 */

const uk = { name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB' };
const today = new Date('2026-10-06T00:00:00Z');

function apiRow(slug: string, over: Record<string, unknown> = {}) {
  return {
    id: `id-${slug}`,
    name: 'MSc Computer Science',
    slug,
    studyMode: 'FULL_TIME',
    durationMin: '1',
    durationMax: '1',
    durationUnit: 'YEARS',
    tuitionMin: null,
    tuitionMax: null,
    currencyCode: null,
    tuitionPeriod: null,
    applicationUrl: null,
    sourceReference: null,
    campus: { name: 'Main campus', city: 'Coventry' },
    university: {
      name: 'University of Warwick',
      slug: 'university-of-warwick',
      websiteUrl: null,
      country: uk,
      campuses: [{ city: 'Coventry' }],
    },
    genericCourse: {
      qualificationName: 'Master of Science',
      courseLevel: { code: 'PG', name: "Master's" },
      subject: { name: 'Computer Science', slug: 'computer-science' },
    },
    intakes: [
      {
        status: 'ACTIVE',
        deadline: '2027-08-02T00:00:00.000Z',
        intake: { name: 'September', startMonth: 9, endMonth: 9 },
      },
    ],
    requirements: [
      {
        category: 'ENGLISH_TEST',
        title: 'IELTS',
        minimumScore: '6.50',
        description: 'Band A: 6.5 overall.',
        status: 'ACTIVE',
        deletedAt: null,
      },
    ],
    ...over,
  };
}

const column = (slug: string, over: Record<string, unknown> = {}) =>
  toCompareColumn(apiRow(slug, over), today)!;

const render = (
  columns: CompareColumn[],
  { requested = columns.map((entry) => entry.slug), invalid = [] as string[] } = {},
) =>
  renderToStaticMarkup(
    <CourseComparePage
      requested={requested}
      columns={columns}
      invalid={invalid}
      options={[{ slug: 'other', label: 'BSc Law — Elmswood University' }]}
    />,
  );

/** The text of each body row's cells, by row name. */
function table(html: string) {
  const rows: Record<string, string[]> = {};
  const body = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));
  for (const match of body.matchAll(/<tr><th scope="row">([^<]+)<\/th>(.*?)<\/tr>/g)) {
    rows[match[1]!] = [...match[2]!.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((cell) =>
      cell[1]!.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").trim(),
    );
  }
  return rows;
}

describe('the course comparison', () => {
  it('sits in the design: crumbs Home / Courses / Compare and the hero', () => {
    const html = render([column('a'), column('b')]);
    expect(html).toContain('<nav class="crumbs" aria-label="Breadcrumb">');
    expect(html).toContain('href="/courses">Courses</a>');
    expect(html).toContain('<span aria-current="page">Compare</span>');
    expect(html).toContain('Compare courses side by side');
    expect(html).toContain('Comparison<b>·</b>up to 4 courses');
  });

  it('lists the design’s twelve rows, in its order', () => {
    expect(Object.keys(table(render([column('a'), column('b')])))).toEqual([
      'University',
      'Location',
      'Degree',
      'Duration',
      'Tuition',
      'Language',
      'Intake',
      'Application deadline',
      'Academic requirement',
      'Language requirement',
      'Work experience',
      'Study mode',
    ]);
  });

  it('fills the rows from the record: Full time, English on its IELTS, the deadline', () => {
    const rows = table(render([column('a')]));
    expect(rows['University']).toEqual(['University of Warwick']);
    expect(rows['Location']).toEqual(['Coventry, United Kingdom']);
    expect(rows['Degree']).toEqual(["Master's · Master of Science"]);
    expect(rows['Duration']).toEqual(['1 year']);
    expect(rows['Language']).toEqual(['EnglishIELTS 6.5 minimum']);
    expect(rows['Intake']).toEqual(['September']);
    expect(rows['Application deadline']).toEqual(['2 August 2027']);
    expect(rows['Language requirement']).toEqual(['IELTS 6.5 minimumBand A: 6.5 overall.']);
    expect(rows['Study mode']).toEqual(['Full time']);
    expect(render([column('a')])).not.toContain('FULL_TIME');
  });

  it('says “Not listed” or “Check official source” where the record is silent', () => {
    const silent = column('a', {
      studyMode: null,
      durationMin: null,
      durationMax: null,
      genericCourse: {},
      campus: null,
      university: { name: 'University of Warwick', slug: 'university-of-warwick' },
      intakes: [],
      requirements: [],
    });
    const rows = table(render([silent]));
    for (const key of ['Location', 'Degree', 'Duration', 'Tuition', 'Language', 'Intake', 'Application deadline', 'Language requirement', 'Study mode'])
      expect(rows[key]).toEqual(['Not listed']);
    expect(rows['Academic requirement']).toEqual(['Check official source']);
    expect(rows['Work experience']).toEqual(['Check official source']);
    /* Nothing official to point to: the words, not a link. */
    expect(render([silent])).not.toContain('target="_blank"');
  });

  it('links “Check official source” to the course’s own page when the record has one', () => {
    const html = render([
      column('a', { sourceReference: 'https://warwick.example/msc', requirements: [] }),
    ]);
    expect(html).toContain(
      '<a href="https://warwick.example/msc" rel="nofollow noopener" target="_blank">Check official source ↗</a>',
    );
  });

  it('reads the academic and work-experience requirements when they are recorded', () => {
    const rows = table(
      render([
        column('a', {
          requirements: [
            { category: 'ACADEMIC', title: 'Upper second-class degree', status: 'ACTIVE' },
            { category: 'WORK_EXPERIENCE', title: 'Two years in industry', status: 'ACTIVE' },
            /* Withdrawn and deleted entries are not requirements. */
            { category: 'ENGLISH_TEST', title: 'TOEFL', minimumScore: '90', status: 'INACTIVE' },
            { category: 'ENGLISH_TEST', title: 'PTE', minimumScore: '60', deletedAt: '2026-01-01' },
          ],
        }),
      ]),
    );
    expect(rows['Academic requirement']).toEqual(['Upper second-class degree']);
    expect(rows['Work experience']).toEqual(['Two years in industry']);
    expect(rows['Language']).toEqual(['Not listed']);
    expect(rows['Language requirement']).toEqual(['Not listed']);
  });

  it('marks a passed deadline as passed rather than as open', () => {
    const rows = table(
      render([
        column('a', {
          intakes: [{ deadline: '2026-01-15', intake: { name: 'January', startMonth: 1, endMonth: 1 } }],
        }),
      ]),
    );
    expect(rows['Application deadline']).toEqual(['15 January 2026 (passed)']);
  });

  it('puts a Remove under each programme that drops only that one', () => {
    const requested = ['a', 'b', 'c'];
    const html = render([column('a'), column('b'), column('c')], { requested });
    const removes = [...html.matchAll(/<a class="cmpremove"[^>]* href="([^"]+)"/g)].map((m) => m[1]);
    expect(removes).toEqual([
      '/compare/courses?items=b,c',
      '/compare/courses?items=a,c',
      '/compare/courses?items=a,b',
    ]);
    expect(withoutSlug(['a'], 'a')).toBe('/compare/courses');
  });

  it('links a programme’s name to its page only when its country is known', () => {
    const filed = render([column('a')]);
    expect(filed).toContain(
      'class="cmphead__name" href="/study-abroad/united-kingdom/universities/university-of-warwick/courses/a"',
    );
    /* The compare API before it named the country: the column still compares. */
    const unfiled = render([
      column('a', { university: { name: 'University of Warwick', slug: 'university-of-warwick' } }),
    ]);
    expect(unfiled).toContain('<span class="cmphead__name">MSc Computer Science</span>');
    expect(table(unfiled)['Location']).toEqual(['Coventry']);
    expect(unfiled).toContain('href="/universities/university-of-warwick"');
  });

  it('keeps the design’s “Which course fits me best?” card and the plan band', () => {
    const html = render([column('a'), column('b')]);
    expect(html).toContain('<h3 class="magnet__t">Which course fits me best?</h3>');
    expect(html).toContain('data-testid="assessment-cta-compare-courses"');
    expect(html).toContain('id="plan"');
  });

  it('keeps the search field beside the “Add a course…” list', () => {
    const html = render([column('a')]);
    const pick = html.slice(html.indexOf('class="comparepick"'));
    expect(pick.indexOf('id="compare-course-search"')).toBeGreaterThan(-1);
    expect(pick.indexOf('id="compare-course-search"')).toBeLessThan(
      pick.indexOf('id="compare-course-add"'),
    );
    expect(html).toContain('Add a course…');
    expect(html).toContain('BSc Law — Elmswood University');
    expect(html).toContain('Clear all');
  });

  it('shows the design’s empty state, leading to the course search rather than home', () => {
    const html = render([]);
    expect(html).toContain('No courses selected yet.');
    expect(html).toContain('class="btn" href="/courses"');
    expect(html).not.toContain('href="/">Browse countries');
    expect(html).not.toContain('<table');
  });
});

describe('which lower figure is marked', () => {
  const fee = (slug: string, figure: string, currency = 'GBP', period = 'PER_YEAR') =>
    column(slug, { tuitionMin: figure, currencyCode: currency, tuitionPeriod: period });

  it('marks the lower tuition when every fee is in one currency for one period', () => {
    const html = render([fee('a', '30000'), fee('b', '26000')]);
    expect(html).toMatch(/<td class="is-best"><b>GBP 26,000\/yr<\/b><span class="sr-only"> \(lowest tuition\)/);
    expect(compareMarks([fee('a', '30000'), fee('b', '26000')]).tuition).toBe(1);
  });

  it('marks no tuition across currencies, periods, gaps or a tie', () => {
    expect(compareMarks([fee('a', '30000'), fee('b', '26000', 'EUR')]).tuition).toBeUndefined();
    expect(compareMarks([fee('a', '30000'), fee('b', '26000', 'GBP', 'TOTAL')]).tuition).toBeUndefined();
    expect(compareMarks([fee('a', '30000'), column('b')]).tuition).toBeUndefined();
    expect(compareMarks([fee('a', '26000'), fee('b', '26000')]).tuition).toBeUndefined();
    expect(compareMarks([fee('a', '26000')]).tuition).toBeUndefined();
  });

  it('marks the shorter duration, across years and months', () => {
    const marks = compareMarks([
      column('a', { durationMin: '2', durationMax: '2', durationUnit: 'YEARS' }),
      column('b', { durationMin: '18', durationMax: '18', durationUnit: 'MONTHS' }),
    ]);
    expect(marks.duration).toBe(1);
    expect(
      compareMarks([column('a'), column('b', { durationUnit: 'SEMESTERS' })]).duration,
    ).toBeUndefined();
  });
});

describe('what the address asks for', () => {
  it('reads the reference’s ids as well as items, each programme once and four at most', () => {
    expect(readCompareSlugs({ ids: 'abc,6427' })).toEqual(['abc', '6427']);
    expect(readCompareSlugs({ items: 'A,b', ids: 'b,c' })).toEqual(['a', 'b', 'c']);
    expect(readCompareSlugs({ items: 'a,b,c,d,e' })).toEqual(['a', 'b', 'c', 'd']);
    expect(readCompareSlugs({})).toEqual([]);
  });

  it('names an option by its programme and university when the API says which', () => {
    expect(
      toCompareOptions([
        { slug: 'x', name: 'MSc Data at Elmswood University', university: { name: 'Elmswood University', country: { name: 'Ireland' } } },
        { slug: 'y', name: 'BSc Law' },
        { name: 'no slug' },
      ]),
    ).toEqual([
      { slug: 'x', label: 'MSc Data — Elmswood University, Ireland' },
      { slug: 'y', label: 'BSc Law' },
    ]);
  });
});

describe('the comparison’s route', () => {
  beforeEach(() => {
    phaseCompare.mockReset();
    phaseComparisonOptions.mockReset().mockResolvedValue([]);
  });

  const page = async (query: Record<string, string>) =>
    renderToStaticMarkup(
      await CompareCoursesPage({ searchParams: Promise.resolve(query) }),
    );

  it('lists numeric ids from the reference as unavailable, with a way to drop each', async () => {
    phaseCompare.mockResolvedValue({ items: [], invalid: ['6427', 'abc'] });
    const html = await page({ ids: '6427,abc' });
    expect(phaseCompare).toHaveBeenCalledWith('courses', ['6427', 'abc']);
    expect(html).toContain('These are not published courses in our catalogue');
    expect(html).toContain('<code>6427</code>');
    expect(html).toContain('href="/compare/courses?items=abc"');
    expect(html).toContain('No courses selected yet.');
  });

  it('compares four even where the API keeps three, asking again for the rest', async () => {
    phaseCompare
      .mockResolvedValueOnce({ items: [apiRow('a'), apiRow('b'), apiRow('c')], invalid: [] })
      .mockResolvedValueOnce({ items: [apiRow('d')], invalid: [] });
    const html = await page({ items: 'a,b,c,d' });
    expect(phaseCompare).toHaveBeenNthCalledWith(2, 'courses', ['d']);
    expect((html.match(/class="cmpremove"/g) ?? []).length).toBe(4);
    expect(html).toContain('href="/compare/courses?items=a,b,c"');
  });

  it('keeps the address’s order whatever order the answer came in', async () => {
    phaseCompare.mockResolvedValue({
      items: [apiRow('b', { name: 'BSc B' }), apiRow('a', { name: 'MSc A' })],
      invalid: [],
    });
    const html = await page({ items: 'a,b' });
    expect(html.indexOf('MSc A')).toBeLessThan(html.indexOf('BSc B'));
  });

  it('says the comparison could not be loaded when the API is down, not that nothing exists', async () => {
    phaseCompare.mockRejectedValue(new Error('down'));
    phaseComparisonOptions.mockRejectedValue(new Error('down'));
    const html = await page({ items: 'a' });
    expect(html).toContain('The comparison could not be loaded just now.');
    expect(html).not.toContain('not published courses');
  });

  it('asks the API nothing about programmes when the address names none', async () => {
    const html = await page({});
    expect(phaseCompare).not.toHaveBeenCalled();
    expect(html).toContain('No courses selected yet.');
  });
});

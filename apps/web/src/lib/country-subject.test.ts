import { describe, expect, it } from 'vitest';
import {
  countrySubjectPage,
  figuresHere,
  intakeFigure,
  overviewParts,
  programmesHere,
  rankSpecializations,
  specializationCountsHere,
  subjectsForCountry,
} from './country-subject';

const spec = (name: string, slug: string, publishedCourseCount = 0) => ({
  id: slug,
  name,
  slug,
  publishedCourseCount,
});

describe('specializations on a destination-and-subject page', () => {
  it('puts the ones with programmes first, deepest first', () => {
    const order = rankSpecializations([
      spec('Applied Systems', 'applied-systems', 0),
      spec('Civil Engineering', 'civil', 7),
      spec('Mechanical Engineering', 'mechanical', 8),
    ]).map((row) => row.slug);
    expect(order).toEqual(['mechanical', 'civil', 'applied-systems']);
  });

  it('keeps the empty ones, alphabetically, rather than hiding them', () => {
    // The catalogue covering a field unevenly is a fact about the catalogue.
    const order = rankSpecializations([
      spec('Zoology', 'zoology'),
      spec('Agronomy', 'agronomy'),
    ]).map((row) => row.slug);
    expect(order).toEqual(['agronomy', 'zoology']);
  });
});

describe('the other subjects offered beside it', () => {
  const others = [
    { id: '1', name: 'Engineering', slug: 'engineering' },
    { id: '2', name: 'Law', slug: 'law' },
    { id: '3', name: 'Medicine', slug: 'medicine' },
  ];

  it('never offers the subject the reader is already on', () => {
    const view = countrySubjectPage({
      specializations: [],
      others,
      subjectSlug: 'engineering',
    });
    expect(view.others.map((row) => row.slug)).toEqual(['law', 'medicine']);
  });

  it('stops at eight, because this is a footer and not a listing', () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      name: `Subject ${index}`,
      slug: `subject-${index}`,
    }));
    const view = countrySubjectPage({
      specializations: [],
      others: many,
      subjectSlug: 'none-of-them',
    });
    expect(view.others).toHaveLength(8);
  });
});

describe('which subjects a destination shows', () => {
  const linked = [{ id: '1', name: 'Engineering', slug: 'engineering' }];
  const catalogue = [
    { id: '1', name: 'Engineering', slug: 'engineering' },
    { id: '2', name: 'Law', slug: 'law' },
    { id: '3', name: 'Medicine', slug: 'medicine' },
  ];

  it('shows its own when it has them', () => {
    const view = subjectsForCountry({ linked, catalogue });
    expect(view.subjects.map((row) => row.slug)).toEqual(['engineering']);
    expect(view.listed).toBe(true);
  });

  it('falls back to the catalogue rather than showing nothing', () => {
    // A destination with no courses yet is not a destination with no fields.
    const view = subjectsForCountry({ linked: [], catalogue });
    expect(view.subjects).toHaveLength(3);
    expect(view.listed).toBe(false);
  });

  it('still has nothing to show when the catalogue is empty too', () => {
    const view = subjectsForCountry({ linked: [], catalogue: [] });
    expect(view.subjects).toEqual([]);
    expect(view.listed).toBe(false);
  });
});

/* The course filters' specialization options, as the API sends them for one
   subject in one destination. */
const option = (value: string, count: number, subject = 'computer-science') => ({
  value,
  count,
  subject: { slug: subject },
});

describe("a destination's own counts per specialization", () => {
  it('reads them from the course filters, by slug', () => {
    const counts = specializationCountsHere(
      { subSubjects: [option('software-engineering', 2), option('machine-learning', 1)] },
      'computer-science',
    );
    expect(counts?.get('software-engineering')).toBe(2);
    expect(counts?.get('machine-learning')).toBe(1);
  });

  it("leaves out another subject's branch that shares a slug", () => {
    // `artificial-intelligence` is a record under Computer Science and
    // another under Engineering; only this subject's is this page's.
    const counts = specializationCountsHere(
      {
        subSubjects: [
          option('artificial-intelligence', 1),
          option('artificial-intelligence', 9, 'engineering'),
        ],
      },
      'computer-science',
    );
    expect(counts?.get('artificial-intelligence')).toBe(1);
  });

  it('is an empty map, not null, where the destination teaches none of them', () => {
    const counts = specializationCountsHere({ subSubjects: [] }, 'computer-science');
    expect(counts).not.toBeNull();
    expect(counts?.size).toBe(0);
  });

  it('is null when the filters could not be read', () => {
    expect(specializationCountsHere(null, 'computer-science')).toBeNull();
  });
});

describe('the specializations ranked by what one destination teaches', () => {
  // Worldwide, Strategic Communication has the most; in the UK it has none.
  const worldwide = [
    spec('Strategic Communication', 'strategic-communication', 7),
    spec('Software Engineering', 'software-engineering', 6),
    spec('Artificial Intelligence', 'artificial-intelligence', 3),
    spec('Applied Systems', 'applied-systems', 0),
  ];

  it("ranks and counts by the destination's figures, not the worldwide ones", () => {
    const view = countrySubjectPage({
      specializations: worldwide,
      others: [],
      subjectSlug: 'computer-science',
      countsHere: new Map([
        ['software-engineering', 2],
        ['artificial-intelligence', 1],
      ]),
    });
    expect(view.specializations.map((row) => [row.slug, row.here])).toEqual([
      ['software-engineering', 2],
      ['artificial-intelligence', 1],
      ['applied-systems', 0],
      ['strategic-communication', 0],
    ]);
    expect(view.taughtHere).toBe(2);
  });

  it('counts nothing and ranks A to Z in a destination teaching none of them', () => {
    const view = countrySubjectPage({
      specializations: worldwide,
      others: [],
      subjectSlug: 'computer-science',
      countsHere: new Map(),
    });
    expect(view.specializations.every((row) => row.here === 0)).toBe(true);
    expect(view.specializations[0].slug).toBe('applied-systems');
    expect(view.taughtHere).toBe(0);
  });

  it('states no count at all when the filters could not be read', () => {
    // Null is not zero, and the worldwide figures are not a fallback.
    const view = countrySubjectPage({
      specializations: worldwide,
      others: [],
      subjectSlug: 'computer-science',
      countsHere: null,
    });
    expect(view.specializations.every((row) => row.here === null)).toBe(true);
    expect(view.specializations[0].slug).toBe('applied-systems');
    expect(view.taughtHere).toBeNull();
  });
});

describe('whether a destination teaches a field, as far as the page can tell', () => {
  it('has levels when the grouped read found some', () => {
    expect(programmesHere([{}], null)).toBe('levels');
  });

  it('says none only when a read answered with nothing', () => {
    expect(programmesHere([], null)).toBe('none');
    expect(programmesHere(null, { data: [] })).toBe('none');
  });

  it('falls back to the flat list when the grouped read failed', () => {
    expect(programmesHere(null, { data: [{}] })).toBe('list');
  });

  it('does not claim there are none when it could not read either', () => {
    expect(programmesHere(null, null)).toBe('unknown');
  });
});

describe('the intakes figure', () => {
  const intake = (label: string, startMonth: number | null, count = 1) => ({
    label,
    startMonth,
    count,
  });

  it('names a few months in calendar order, once each', () => {
    expect(
      intakeFigure([
        intake('Sep', 9),
        intake('Jul', 7),
        intake('September (late)', 9),
        intake('Aug', 8),
      ]),
    ).toBe('Jul, Aug, Sep');
  });

  it('counts them once there are too many to read at a glance', () => {
    expect(
      intakeFigure([intake('a', 1), intake('b', 2), intake('c', 5), intake('d', 9)]),
    ).toBe('4 intake months');
  });

  it('ignores intakes nothing opens in, and states nothing without any', () => {
    expect(intakeFigure([intake('Jan', 1, 0)])).toBeNull();
    expect(intakeFigure([])).toBeNull();
  });

  it("keeps an intake's own label when it has no month", () => {
    expect(intakeFigure([intake('Rolling', null)])).toBe('Rolling');
  });
});

describe('the figures strip', () => {
  it('states only the figures the destination has', () => {
    expect(
      figuresHere({ programmes: 6, universities: 11, specializations: 4, intakes: 'Sep' }),
    ).toEqual([
      { label: 'Programmes', value: '6' },
      { label: 'Universities', value: '11' },
      { label: 'Specializations taught', value: '4' },
      { label: 'Intakes', value: 'Sep' },
    ]);
  });

  it('leaves out a zero or an unknown rather than printing it', () => {
    expect(
      figuresHere({ programmes: 2, universities: null, specializations: 0, intakes: null }),
    ).toEqual([{ label: 'Programmes', value: '2' }]);
  });

  it('says one of each in the singular', () => {
    expect(
      figuresHere({ programmes: 1, universities: 1, specializations: 1, intakes: null }),
    ).toEqual([
      { label: 'Programme', value: '1' },
      { label: 'University', value: '1' },
      { label: 'Specialization taught', value: '1' },
    ]);
  });

  it('is empty where the destination has nothing to count', () => {
    expect(figuresHere({ programmes: 0, universities: 0, intakes: null })).toEqual([]);
  });
});

describe('an overview split into a lead and a read-more', () => {
  it('shows the first paragraph and folds the rest away', () => {
    const parts = overviewParts('<p>One.</p><h3>More</h3><p>Two.</p>');
    expect(parts).toEqual({ lead: '<p>One.</p>', rest: '<h3>More</h3><p>Two.</p>' });
  });

  it('keeps a heading with the paragraph under it', () => {
    const parts = overviewParts('<h3>What you study</h3><p>One.</p><p>Two.</p>');
    expect(parts.lead).toBe('<h3>What you study</h3><p>One.</p>');
    expect(parts.rest).toBe('<p>Two.</p>');
  });

  it('does not repeat a first paragraph the hero has already printed', () => {
    const parts = overviewParts(
      '<p>The study of computation.</p><p>Algorithms and systems.</p>',
      'The study of computation.',
    );
    expect(parts).toEqual({ lead: '<p>Algorithms and systems.</p>', rest: null });
  });

  it('leaves markup it cannot split whole, under the read-more', () => {
    const html = '<div><p>Wrapped.</p></div>';
    expect(overviewParts(html)).toEqual({ lead: null, rest: html });
  });

  it('is nothing at all without an overview', () => {
    expect(overviewParts(null)).toEqual({ lead: null, rest: null });
    expect(overviewParts('   ')).toEqual({ lead: null, rest: null });
  });
});

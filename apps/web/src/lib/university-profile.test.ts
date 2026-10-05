import { describe, expect, it } from 'vitest';
import {
  deadlineLabel,
  intakeSummary,
  levelsTaught,
  moneyRange,
  orderOfferings,
  popularSubjects,
  splitOverview,
  studyModeLabel,
  tuitionByLevel,
  tuitionPeriod,
  type ProfileOffering,
} from './university-profile';

const course = (
  name: string,
  level: { code: string; name: string; order: number } | null,
  over: Partial<ProfileOffering> = {},
): ProfileOffering => ({
  name,
  subject: { name: 'Law', slug: 'law' },
  courseLevel: level,
  ...over,
});
const UG = { code: 'UG', name: "Bachelor's", order: 3 };
const PG = { code: 'PG', name: "Master's", order: 4 };
const FOUNDATION = { code: 'FOUNDATION', name: 'Foundation Program', order: 1 };
const DIPLOMA = { code: 'DIPLOMA', name: 'Diploma', order: 7 };

/**
 * The behaviour reference shows a university's first six courses with the
 * undergraduate ones leading, A to Z. The catalogue's own order was 0 on
 * every offering, so the list came back in whatever order the database
 * chose.
 */
describe('the order a university lists its courses in', () => {
  it("puts Bachelor's first, then the other levels in the catalogue's order, A to Z inside each", () => {
    const ordered = orderOfferings([
      course('MSc Zoology', PG),
      course('Dip Nursing', DIPLOMA),
      course('LLB Law', UG),
      course('Foundation Year', FOUNDATION),
      course('BA Economics', UG),
      course('MSc Accounting', PG),
    ]).map((entry) => entry.name);
    expect(ordered).toEqual([
      'BA Economics',
      'LLB Law',
      'Foundation Year',
      'MSc Accounting',
      'MSc Zoology',
      'Dip Nursing',
    ]);
  });

  it('sorts by the name the page shows, when it is told what that is', () => {
    const ordered = orderOfferings(
      [course('Zeta at Elm', UG), course('Alpha at Elm', UG)],
      (entry) => entry.name.replace(' at Elm', ''),
    ).map((entry) => entry.name);
    expect(ordered).toEqual(['Alpha at Elm', 'Zeta at Elm']);
  });

  it('keeps a course with no level, after the rest', () => {
    expect(
      orderOfferings([course('No level', null), course('BA', UG)]).map((entry) => entry.name),
    ).toEqual(['BA', 'No level']);
  });

  it('lists the levels taught, in the same order, with how many courses each', () => {
    expect(
      levelsTaught([course('MSc', PG), course('BA', UG), course('LLB', UG)]),
    ).toEqual([
      { name: "Bachelor's", count: 2 },
      { name: "Master's", count: 1 },
    ]);
  });
});

describe('the subjects a university is popular for', () => {
  it('counts its courses per subject, the biggest first', () => {
    const subjects = popularSubjects([
      course('A', UG, { subject: { name: 'Law', slug: 'law' } }),
      course('B', UG, { subject: { name: 'Economics', slug: 'economics' } }),
      course('C', UG, { subject: { name: 'Law', slug: 'law' } }),
      course('D', UG, { subject: null }),
    ]);
    expect(subjects).toEqual([
      { name: 'Law', slug: 'law', count: 2 },
      { name: 'Economics', slug: 'economics', count: 1 },
    ]);
  });

  it('names no more subjects than it is asked for', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      course(`C${index}`, UG, { subject: { name: `S${index}`, slug: `s${index}` } }),
    );
    expect(popularSubjects(many, 8)).toHaveLength(8);
  });
});

/**
 * Every catalogue overview opens with the university's short description,
 * which the hero has already shown and the section head shows as its lead.
 * The page said its first sentence three times in a row.
 */
describe('an overview split into the design’s highlights', () => {
  const short = 'Oxford is the oldest university in the English-speaking world.';
  const overview = `<p>${short}</p><p>Founded in 1096.</p><h3>What it is strong in</h3><p>Philosophy.</p><h3>The campus</h3><p>No single campus.</p><p>Colleges.</p>`;

  it('drops an opening paragraph that only repeats the short description', () => {
    const { intro } = splitOverview(overview, short);
    expect(intro).toBe('<p>Founded in 1096.</p>');
  });

  it('keeps an opening that says something else', () => {
    expect(splitOverview(overview, 'A different line.').intro).toContain(short);
  });

  it('turns each sub-heading and the text under it into a numbered highlight', () => {
    const { highlights } = splitOverview(overview, short);
    expect(highlights).toEqual([
      { title: 'What it is strong in', body: '<p>Philosophy.</p>' },
      { title: 'The campus', body: '<p>No single campus.</p><p>Colleges.</p>' },
    ]);
  });

  it('leaves an overview without sub-headings as one opening', () => {
    expect(splitOverview('<p>One.</p><p>Two.</p>', null)).toEqual({
      intro: '<p>One.</p><p>Two.</p>',
      highlights: [],
    });
  });

  it('has no opening when the overview was only the repeated sentence', () => {
    expect(splitOverview(`<p>${short}</p>`, short).intro).toBeNull();
  });
});

describe('what the courses say about fees', () => {
  const priced = (name: string, level: typeof UG, min: string, max: string | null, currencyCode = 'GBP') =>
    course(name, level, { tuition: { min, max, currencyCode, period: 'PER_YEAR' } });

  it('gives each level the range of the fees its courses state', () => {
    const rows = tuitionByLevel([
      priced('BA', UG, '24000', null),
      priced('LLB', UG, '30000', '32000'),
      course('BSc', UG),
      priced('MSc', PG, '36000', null),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ level: "Bachelor's", min: 24000, max: 32000, priced: 2, courses: 3 }),
      expect.objectContaining({ level: "Master's", min: 36000, max: 36000, priced: 1, courses: 1 }),
    ]);
  });

  it('never adds two currencies into one range', () => {
    expect(
      tuitionByLevel([priced('BA', UG, '24000', null), priced('BSc', UG, '30000', null, 'EUR')]),
    ).toHaveLength(2);
  });

  it('has nothing to say when no course states a fee', () => {
    expect(tuitionByLevel([course('BA', UG)])).toEqual([]);
  });

  it('writes a range and its period the way the page prints them', () => {
    expect(moneyRange('24000', '32000', 'GBP')).toBe('GBP 24,000–32,000');
    expect(moneyRange('24000', '24000', 'GBP')).toBe('GBP 24,000');
    expect(moneyRange(null, null, 'GBP')).toBeNull();
    expect(tuitionPeriod('PER_YEAR')).toBe('per year');
    expect(tuitionPeriod('SOMETHING')).toBeNull();
  });
});

describe('what the courses say about intakes', () => {
  const intake = (key: string, month: number, deadline: string | null) => ({
    key,
    name: key,
    month,
    deadline,
  });

  const today = new Date('2026-10-05T09:30:00.000Z');

  it('counts the courses in each intake and keeps the earliest deadline still to come', () => {
    const summary = intakeSummary(
      [
        course('A', UG, { intakes: [intake('September', 9, '2027-03-01'), intake('January', 1, null)] }),
        course('B', UG, { intakes: [intake('September', 9, '2027-01-15')] }),
      ],
      today,
    );
    expect(summary).toEqual([
      { key: 'January', name: 'January', month: 1, courses: 1, deadline: null, passed: false },
      {
        key: 'September',
        name: 'September',
        month: 9,
        courses: 2,
        deadline: '2027-01-15',
        passed: false,
      },
    ]);
  });

  /* Lakeside's January intake: one course closed on 15 September, two are
     open until 15 October and 15 November. Taking the earliest of the three
     showed the intake as closing on a date already gone, and hid the two
     still open. */
  it('passes over a deadline that has gone by when a later one is still open', () => {
    const [january] = intakeSummary(
      [
        course('A', UG, { intakes: [intake('January', 1, '2026-09-15T00:00:00.000Z')] }),
        course('B', UG, { intakes: [intake('January', 1, '2026-11-15T00:00:00.000Z')] }),
        course('C', UG, { intakes: [intake('January', 1, '2026-10-15T00:00:00.000Z')] }),
      ],
      today,
    );
    expect(january).toMatchObject({ courses: 3, deadline: '2026-10-15T00:00:00.000Z', passed: false });
  });

  it('keeps a deadline of today as open, whatever the hour', () => {
    const [entry] = intakeSummary(
      [course('A', UG, { intakes: [intake('January', 1, '2026-10-05T00:00:00.000Z')] })],
      new Date('2026-10-05T23:59:00.000Z'),
    );
    expect(entry).toMatchObject({ deadline: '2026-10-05T00:00:00.000Z', passed: false });
  });

  it('marks the last deadline as passed only when every one has gone by', () => {
    const [entry] = intakeSummary(
      [
        course('A', UG, { intakes: [intake('January', 1, '2026-09-15')] }),
        course('B', UG, { intakes: [intake('January', 1, '2026-08-01')] }),
      ],
      today,
    );
    expect(entry).toMatchObject({ deadline: '2026-09-15', passed: true });
  });

  it('writes a deadline as a date, the same on the server and in the browser', () => {
    expect(deadlineLabel('2027-01-15T00:00:00.000Z')).toBe('15 January 2027');
    expect(deadlineLabel('not a date')).toBeNull();
  });
});

it('writes a study mode as words', () => {
  expect(studyModeLabel('FULL_TIME')).toBe('Full time');
  expect(studyModeLabel(null)).toBeNull();
});

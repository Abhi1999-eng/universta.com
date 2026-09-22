import { describe, expect, it } from 'vitest';
import type { CountryPage } from './countries';
import {
  alternatingBands,
  costBreakdown,
  countrySnapshot,
  guideIntakes,
  intakeCards,
  journeyColumns,
  languageRows,
  sectionNumbers,
  monthNames,
  searchDestinations,
  workSummary,
} from './study-abroad-view';

/**
 * The snapshot panel and the work cards are built from published figures only.
 * A missing figure omits its row rather than estimating one, which is what stops
 * the panel ever being half empty and stops the page asserting something no
 * editor recorded.
 */
function page(over: {
  cost?: Record<string, unknown> | null;
  work?: Record<string, unknown> | null;
  country?: Record<string, unknown>;
}): CountryPage {
  return {
    country: {
      id: 'c1',
      name: 'Germany',
      slug: 'germany',
      pageHeading: 'Study in Germany',
      shortDescription: null,
      officialLanguage: 'German',
      capitalCity: 'Berlin',
      currency: { code: 'EUR', symbol: '€', name: 'Euro' },
      configuration: {
        features: [],
        acceptedTests: [{ code: 'IELTS', label: 'IELTS' }],
        intakeMonths: [4, 10],
        postStudyWorkPermitMonths: null,
        calculator: null,
      },
      statistics: null,
      ...over.country,
    },
    profiles: {
      cost: over.cost ?? null,
      work: over.work ?? null,
      language: null,
      statistics: null,
      intakes: [],
    },
    sections: [],
    faqs: [],
    seo: null,
    consultantCards: [],
  } as unknown as CountryPage;
}

describe('country snapshot', () => {
  it('shows a tuition range when one is published', () => {
    const rows = countrySnapshot(
      page({ cost: { tuitionMin: '12000', tuitionMax: '38000', currencyCode: 'EUR' } }),
    );
    expect(rows.find((row) => row.label === 'Typical tuition')?.value).toBe('€12,000 – €38,000');
  });

  it('leaves tuition out entirely when nothing is published', () => {
    const rows = countrySnapshot(page({ cost: null }));
    expect(rows.find((row) => row.label === 'Typical tuition')).toBeUndefined();
  });

  it('annualises a monthly living cost rather than printing a monthly figure as yearly', () => {
    const rows = countrySnapshot(
      page({
        cost: { livingCostMin: '850', livingCostMax: '1200', livingCostPeriod: 'PER_MONTH' },
      }),
    );
    expect(rows.find((row) => row.label === 'Typical living cost')?.value).toBe(
      '€10,200 – €14,400',
    );
  });

  it('leaves a yearly living cost alone', () => {
    const rows = countrySnapshot(
      page({
        cost: { livingCostMin: '10200', livingCostMax: '14400', livingCostPeriod: 'PER_YEAR' },
      }),
    );
    expect(rows.find((row) => row.label === 'Typical living cost')?.value).toBe(
      '€10,200 – €14,400',
    );
  });

  it('names the intake months in calendar order', () => {
    const rows = countrySnapshot(page({}));
    expect(rows.find((row) => row.label === 'Main intakes')?.value).toBe('April · October');
  });

  it('builds a panel of only the rows it can fill', () => {
    const rows = countrySnapshot(
      page({ country: { officialLanguage: null, capitalCity: null, configuration: {
        features: [], acceptedTests: [], intakeMonths: [], postStudyWorkPermitMonths: null,
        calculator: null,
      } } }),
    );
    expect(rows).toEqual([]);
  });
});

describe('month names', () => {
  it('sorts and names the months', () => {
    expect(monthNames([9, 1])).toEqual(['January', 'September']);
  });

  it('drops anything that is not a month', () => {
    expect(monthNames([0, 13, 5, -1, 1.5])).toEqual(['May']);
  });
});

describe('work cards', () => {
  it('renders nothing at all when a country publishes no work profile', () => {
    expect(workSummary(page({}).profiles)).toEqual([]);
  });

  it('carries the visa processing time when one is published, and only then', () => {
    const withTime = workSummary(
      page({ work: { visaType: 'Student visa (subclass 500)', visaProcessingTime: '4 to 6 weeks' } })
        .profiles,
    );
    expect(withTime.find((card) => card.title === 'Student visa')?.value).toBe(
      'Student visa (subclass 500) · 4 to 6 weeks processing',
    );
    const withoutTime = workSummary(page({ work: { visaType: 'Study permit' } }).profiles);
    expect(withoutTime.find((card) => card.title === 'Student visa')?.value).toBe('Study permit');
  });

  it('states the weekly hours when they are published', () => {
    const cards = workSummary(
      page({ work: { partTimeAllowed: true, partTimeHoursPerWeek: '20', postStudyWorkAvailable: false } })
        .profiles,
    );
    expect(cards.find((card) => card.title === 'Work while you study')?.value).toBe(
      '20 hours a week',
    );
  });

  it('says permitted, not a number, when the hours are not published', () => {
    const cards = workSummary(
      page({ work: { partTimeAllowed: true, postStudyWorkAvailable: false } }).profiles,
    );
    expect(cards.find((card) => card.title === 'Work while you study')?.value).toBe('Permitted');
  });

  it('does not claim post-study work for a country that does not offer it', () => {
    const cards = workSummary(
      page({ work: { partTimeAllowed: true, postStudyWorkAvailable: false } }).profiles,
    );
    expect(cards.find((card) => card.title === 'Post-study work')).toBeUndefined();
  });

  it('says available, not a duration, when no duration is published', () => {
    const cards = workSummary(
      page({
        work: {
          postStudyWorkAvailable: true,
          postStudyWorkMinMonths: null,
          postStudyWorkMaxMonths: null,
        },
      }).profiles,
    );
    expect(cards.find((card) => card.title === 'Post-study work')?.value).toBe('Available');
  });
});

describe('alternatingBands', () => {
  it('alternates from paper down the run', () => {
    const band = alternatingBands(['a', 'b', 'c', 'd']);
    expect([band('a'), band('b'), band('c'), band('d')]).toEqual([true, false, true, false]);
  });

  /* The point of computing it: a section that stands down must not leave its
     band behind, or the two sections that close up around it end up matching. */
  it('closes the gap when a section stands down', () => {
    const withAll = alternatingBands(['a', 'b', 'c']);
    const without = alternatingBands(['a', 'c']);
    expect(withAll('c')).toBe(true);
    expect(without('c')).toBe(false);
  });

  it('never gives two neighbours the same band', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `s${i}`);
    const band = alternatingBands(ids);
    const clashes = ids.filter((id, i) => i > 0 && band(id) === band(ids[i - 1]));
    expect(clashes).toEqual([]);
  });

  it('gives an id it was never told about the same band as an absent one', () => {
    expect(alternatingBands(['a'])('unknown')).toBe(false);
  });
});

describe('searchDestinations', () => {
  const entry = (name: string, iso2Code: string | null, slug: string | null = null) => ({
    name,
    iso2Code,
    slug,
    isAvailable: slug !== null,
  });
  const all = [
    entry('Algeria', 'DZ'),
    entry('Germany', 'DE', 'germany'),
    entry('Guinea-Bissau', 'GW'),
    entry('New Zealand', 'NZ', 'new-zealand'),
    entry('Niger', 'NE'),
    entry('Nigeria', 'NG'),
    entry("Côte d'Ivoire", 'CI'),
    entry('United Kingdom', 'GB', 'united-kingdom'),
  ];
  const names = (query: string) => searchDestinations(all, query).map((item) => item.name);

  it('lists the guides, in directory order, before anything is typed', () => {
    expect(names('  ')).toEqual(['Germany', 'New Zealand', 'United Kingdom']);
  });

  it('matches from the start of a word, not from anywhere in the name', () => {
    expect(names('ger')).toEqual(['Germany']);
    expect(names('zea')).toEqual(['New Zealand']);
    expect(names('bissau')).toEqual(['Guinea-Bissau']);
  });

  it('matches an ISO code exactly', () => {
    expect(names('de')).toEqual(['Germany']);
    expect(names('GB')).toEqual(['United Kingdom']);
  });

  it('ignores case and accents', () => {
    expect(names('COTE')).toEqual(["Côte d'Ivoire"]);
  });

  it('puts destinations with a guide ahead of the rest', () => {
    expect(names('n')).toEqual(['New Zealand', 'Niger', 'Nigeria']);
  });

  it('treats the query as text, not a pattern', () => {
    expect(names('(')).toEqual([]);
    expect(names('.*')).toEqual([]);
  });
});

describe('sectionNumbers', () => {
  /* Numbered by position among what renders, so a section standing down never
     leaves a gap in the run. */
  it('numbers the rendered run from 01 without gaps', () => {
    const number = sectionNumbers(['why', 'universities', 'faq']);
    expect(number('why')).toBe('01');
    expect(number('universities')).toBe('02');
    expect(number('faq')).toBe('03');
  });

  it('gives an unnumbered section no number', () => {
    expect(sectionNumbers(['why'])('scholarship-funding')).toBeNull();
  });
});

describe('costBreakdown', () => {
  const cost = (over: Record<string, unknown> = {}) =>
    ({
      currencyCode: 'EUR',
      currencySymbol: '€',
      tuitionMin: '0',
      tuitionMax: '20000',
      tuitionPeriod: 'PER_YEAR',
      budgetBand: null,
      livingCostMin: '850',
      livingCostMax: '1300',
      livingCostPeriod: 'PER_MONTH',
      ...over,
    }) as never;

  it('lists each published range with its period', () => {
    expect(costBreakdown(cost()).rows).toEqual([
      { label: 'Tuition', value: '€0 – €20,000', unit: 'per year' },
      { label: 'Living expenses', value: '€850 – €1,300', unit: 'per month' },
    ]);
  });

  it('totals a year of tuition and living when both are published', () => {
    expect(costBreakdown(cost()).total).toBe('€10,200 – €35,600');
  });

  /* The total box shows what its figure is made of, each part per year. */
  it('breaks the total into yearly tuition and living', () => {
    expect(costBreakdown(cost()).parts).toEqual([
      { label: 'Tuition', value: '€0 – €20,000' },
      { label: 'Living', value: '€10,200 – €15,600' },
    ]);
    expect(costBreakdown(cost({ livingCostMin: null, livingCostMax: null })).parts).toEqual([]);
  });

  /* A total from tuition alone would understate what a year costs. */
  it('gives no total when half of it is missing', () => {
    expect(costBreakdown(cost({ livingCostMin: null, livingCostMax: null })).total).toBeNull();
  });

  it('gives no total when a period does not convert to a year', () => {
    expect(costBreakdown(cost({ tuitionPeriod: 'PER_TERM' })).total).toBeNull();
  });

  it('lists the application fee as a one-time cost', () => {
    expect(costBreakdown(cost({ applicationFeeMin: '75' })).rows[2]).toEqual({
      label: 'Application fee',
      value: '€75',
      unit: 'one time',
    });
  });

  it('is empty without a cost profile', () => {
    expect(costBreakdown(null)).toEqual({ total: null, rows: [], parts: [] });
  });
});

describe('languageRows', () => {
  it('reads each test with its requirement and minimum', () => {
    const rows = languageRows({
      ieltsRequirement: 'REQUIRED',
      ieltsMinScore: '6.50',
      toeflRequirement: 'VARIES',
      languageWaiverAvailable: false,
    } as never);
    expect(rows).toEqual([
      { test: 'IELTS Academic', requirement: { label: 'Required', tone: 'req' }, minimum: '6.5', notes: null },
      { test: 'TOEFL iBT', requirement: { label: 'Varies by programme', tone: 'cond' }, minimum: null, notes: null },
    ]);
  });
});

describe('intakeCards', () => {
  it('names each intake from its catalogue entry and marks the major one', () => {
    const cards = intakeCards([
      {
        id: 'ci1',
        isMajor: true,
        applicationOpeningMonth: 5,
        applicationDeadlineNote: '15 July for most programmes',
        intake: { id: 'i1', name: 'Winter intake', slug: 'winter', shortLabel: null, startMonth: 10 },
      },
    ] as never);
    expect(cards).toEqual([
      {
        id: 'ci1',
        name: 'Winter intake',
        month: 10,
        primary: true,
        starts: 'October',
        opening: 'May',
        deadline: '15 July for most programmes',
        notes: null,
      },
    ]);
  });

  /* The catalogue names its intakes by month alone; beside a selected month
     with no record ("February intake") that read as two different styles. */
  it('titles an intake named by its month alone the way the fallback cards are', () => {
    const cards = intakeCards([
      {
        id: 'ci2',
        isMajor: true,
        intake: { id: 'i2', name: 'September', slug: 'september', shortLabel: 'Sep', startMonth: 9 },
      },
    ] as never);
    expect(cards[0].name).toBe('September intake');
  });
});

describe('guideIntakes', () => {
  const record = (month: number, primary = false) => ({
    id: `r${month}`,
    name: month === 10 ? 'Winter intake' : 'Summer intake',
    month,
    primary,
    starts: null,
    opening: null,
    deadline: null,
    notes: null,
  });

  /* The editor's month selection decides what appears; a record only adds
     detail to a month that was selected. */
  it('shows the selected months, with a record where one exists', () => {
    const intakes = guideIntakes([10, 1, 4], [record(10, true), record(4)]);
    expect(intakes.map((entry) => [entry.month, entry.name, entry.primary])).toEqual([
      [1, 'January intake', false],
      [4, 'Summer intake', false],
      [10, 'Winter intake', true],
    ]);
  });

  it('leaves out a record for a month the editor did not select', () => {
    expect(guideIntakes([10], [record(10, true), record(4)]).map((entry) => entry.month)).toEqual([10]);
  });

  it('falls back to the records when nothing is selected', () => {
    expect(guideIntakes([], [record(4)]).map((entry) => entry.id)).toEqual(['r4']);
  });
});

describe('journeyColumns', () => {
  /* Six fixed columns left three visa steps in half the row, and wrapped
     eight application steps six and two. */
  it('puts up to five steps on one row, and divides longer runs evenly', () => {
    expect([1, 3, 5, 6, 8, 9, 7].map(journeyColumns)).toEqual([1, 3, 5, 3, 4, 3, 4]);
  });
});

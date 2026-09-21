import { describe, expect, it } from 'vitest';
import type { CountryPage } from './countries';
import {
  alternatingBands,
  countrySnapshot,
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

import { describe, expect, it } from 'vitest';
import type { CountryPage } from './countries';
import { countrySnapshot, monthNames, workSummary } from './study-abroad-view';

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

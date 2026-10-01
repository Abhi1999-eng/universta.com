import { summariseOfferings } from './country-course-tuition';

/**
 * A destination's indicative tuition for a course and what its universities
 * actually charge were recorded in two places that never looked at each
 * other. A country could quote a figure no institution behind it charges.
 *
 * The offerings are the reality, so the country figure is a summary of
 * them: lowest minimum, highest maximum, across the live ones.
 */

const offering = (
  min: string | number | null,
  max: string | number | null,
  currencyCode: string | null = 'EUR',
) => ({ tuitionMin: min, tuitionMax: max, currencyCode });

describe('what a country’s universities add up to', () => {
  it('spans the cheapest and the dearest', () => {
    expect(
      summariseOfferings([
        offering(12000, 14000),
        offering(9000, 11000),
        offering(15000, 20000),
      ]),
    ).toMatchObject({
      min: '9000',
      max: '20000',
      currencyCode: 'EUR',
      offerings: 3,
    });
  });

  it('reads one offering as its own range', () => {
    expect(summariseOfferings([offering(12000, 14000)])).toMatchObject({
      min: '12000',
      max: '14000',
      offerings: 1,
    });
  });

  it('uses the one figure an offering has when it has only one', () => {
    /* A single price is both ends of that institution's range. */
    expect(summariseOfferings([offering(12000, null)])).toMatchObject({
      min: '12000',
      max: '12000',
    });
    expect(summariseOfferings([offering(null, 18000)])).toMatchObject({
      min: '18000',
      max: '18000',
    });
  });

  it('ignores the offerings that carry no price at all', () => {
    expect(
      summariseOfferings([offering(null, null), offering(12000, 14000)]),
    ).toMatchObject({ min: '12000', max: '14000', offerings: 1 });
  });

  it('says nothing when nothing is priced', () => {
    expect(summariseOfferings([offering(null, null)])).toEqual({
      min: null,
      max: null,
      currencyCode: null,
      offerings: 0,
    });
    expect(summariseOfferings([])).toMatchObject({ offerings: 0 });
  });

  it('refuses to make one range out of two currencies', () => {
    /* Converting them would be inventing a rate, and a range that spans
       EUR and GBP is not a range. */
    const mixed = summariseOfferings([
      offering(12000, 14000, 'EUR'),
      offering(9000, 11000, 'GBP'),
    ]);
    expect(mixed.min).toBeNull();
    expect(mixed.max).toBeNull();
    expect(mixed.currencyCode).toBeNull();
    /* It still reports what it looked at, so a caller can tell the
       difference between "nothing priced" and "priced inconsistently". */
    expect(mixed.offerings).toBe(2);
  });

  it('carries the currency through when they all agree', () => {
    expect(
      summariseOfferings([offering(1, 2, 'GBP'), offering(3, 4, 'GBP')]),
    ).toMatchObject({ currencyCode: 'GBP' });
  });

  it('is not fooled by a figure that is not a number', () => {
    expect(
      summariseOfferings([
        offering('not a price', null),
        offering(12000, 14000),
      ]),
    ).toMatchObject({ min: '12000', max: '14000' });
  });
});

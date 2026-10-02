import { intakeMonthNames, parseIntakeMonths } from './country-bulk';

/**
 * The country sheet could set an intake relation nobody reads and not the
 * month list the country page shows.
 *
 * `intakes` resolves against the Intake master table, which exists so a
 * course mapping can hang an application deadline off a named intake. The
 * country page reads `intakeMonths` instead -- the twelve checkboxes in the
 * editor -- and no column wrote it. An import naming a month that had never
 * been created as a master was rejected outright, which is what happened to
 * every row saying April or October.
 */
describe('the months a destination takes students in', () => {
  const months = (value: string) => {
    const errors: string[] = [];
    return { months: parseIntakeMonths(value, errors), errors };
  };

  it('reads the names the editor shows', () => {
    expect(months('April | October').months).toEqual([4, 10]);
  });

  it('reads the short forms an operator will type', () => {
    expect(months('Jan | Sep').months).toEqual([1, 9]);
  });

  it('reads plain numbers too', () => {
    expect(months('2 | 7').months).toEqual([2, 7]);
  });

  it('does not care about case or spacing', () => {
    expect(months('  february |SEPTEMBER  ').months).toEqual([2, 9]);
  });

  it('puts them in calendar order whatever order they arrive in', () => {
    expect(months('October | February | June').months).toEqual([2, 6, 10]);
  });

  it('keeps one of a month named twice', () => {
    expect(months('March | march | Mar').months).toEqual([3]);
  });

  it('names what it could not read, rather than failing silently', () => {
    const result = months('April | Smarch');
    expect(result.months).toEqual([4]);
    expect(result.errors).toEqual(['intake month "Smarch" is not a month']);
  });

  it('refuses a number that is not a month', () => {
    expect(months('13').errors).toEqual(['intake month "13" is not a month']);
  });

  it('reads an empty cell as no months rather than an error', () => {
    expect(months('').months).toEqual([]);
    expect(months('').errors).toEqual([]);
  });

  it('writes back what it read, so an export round-trips', () => {
    expect(intakeMonthNames([4, 10])).toBe('April | October');
    expect(parseIntakeMonths(intakeMonthNames([2, 6, 9]), [])).toEqual([
      2, 6, 9,
    ]);
  });

  it('writes nothing for a country that has set none', () => {
    expect(intakeMonthNames([])).toBe('');
    expect(intakeMonthNames(null)).toBe('');
  });
});

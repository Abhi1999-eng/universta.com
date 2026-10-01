import { isFutureCalendarDate } from './catalog.constants';

/**
 * A course mapping's "verified date" is a calendar date, and the check that
 * it is not in the future used to compare it to an instant. A date input
 * sends `YYYY-MM-DD`, which parses as midnight UTC, so an editor in India
 * recording today's date between midnight and 05:30 IST was told the date
 * they were standing in was in the future and the mapping would not save.
 *
 * A calendar date is only genuinely ahead once it has not begun anywhere,
 * and the furthest ahead of UTC any civil calendar runs is UTC+14.
 */
describe('isFutureCalendarDate', () => {
  // 30 September 22:21 UTC is already 1 October in India.
  const now = new Date('2026-09-30T22:21:00.000Z');

  it('accepts the date the editor is standing in, east of UTC', () => {
    expect(isFutureCalendarDate('2026-10-01', now)).toBe(false);
  });

  it('accepts the date UTC itself is on', () => {
    expect(isFutureCalendarDate('2026-09-30', now)).toBe(false);
  });

  it('accepts a date in the past', () => {
    expect(isFutureCalendarDate('2020-01-01', now)).toBe(false);
  });

  it('rejects a date no calendar has reached', () => {
    expect(isFutureCalendarDate('2026-10-02', now)).toBe(true);
    expect(isFutureCalendarDate('2027-01-01', now)).toBe(true);
  });

  it('rejects an instant more than fourteen hours ahead', () => {
    expect(isFutureCalendarDate('2026-10-01T12:22:00.000Z', now)).toBe(true);
  });

  it('accepts an instant inside the fourteen-hour window', () => {
    expect(isFutureCalendarDate('2026-10-01T12:20:00.000Z', now)).toBe(false);
  });

  it('treats an unparseable value as not-future and leaves it to the DTO', () => {
    expect(isFutureCalendarDate('not a date', now)).toBe(false);
  });
});

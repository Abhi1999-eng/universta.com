/**
 * A "verified date" is a calendar date, and checking it is not in the future
 * compares it to an instant. Those are not the same kind of thing.
 *
 * A date input sends `YYYY-MM-DD`, which `new Date()` parses as midnight UTC.
 * An editor in India picking today between midnight and 05:30 IST therefore
 * sent a date the UTC clock had not reached, and both this form and the API
 * told them the date they were standing in was in the future. A calendar date
 * is only genuinely ahead once it has not begun anywhere -- and the furthest
 * ahead of UTC any civil calendar runs is UTC+14 (Kiribati).
 *
 * The API applies the same rule in `catalog.constants.ts`, so a date this
 * accepts is not rejected on save.
 */
export const CALENDAR_AHEAD_OF_UTC_MS = 14 * 60 * 60 * 1000;

/** Whether a supplied date is later than any calendar has yet reached. */
export function isFutureCalendarDate(
  value: string | Date,
  now: Date = new Date(),
): boolean {
  const supplied = new Date(value);
  if (Number.isNaN(supplied.getTime())) return false;
  return supplied.getTime() > now.getTime() + CALENDAR_AHEAD_OF_UTC_MS;
}

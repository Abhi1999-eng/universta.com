/** Locale-stable formatting for server-rendered values.
 *
 * Every public page is server-rendered and then hydrated in the browser. Any
 * value formatted with the *ambient* locale or time zone is formatted twice --
 * once by Node and once by the visitor's browser -- and the two only agree by
 * luck. When they disagree React discards the server HTML and logs a hydration
 * error (#418, "text content does not match"), which is exactly what
 * /study-in-{country} was doing in production: the server rendered
 * "verified Jul 26, 2026" in UTC while a browser west of Greenwich rendered
 * "Jul 25, 2026" for the same instant.
 *
 * So both the locale and the time zone are pinned here. A published
 * verification date is a calendar fact about the record, not about where the
 * reader happens to be sitting, so rendering it in UTC everywhere is also the
 * more correct behaviour -- not merely the more stable one. */

const NUMBER_LOCALE = 'en-US';
const DATE_LOCALE = 'en-US';
const DATE_ZONE = 'UTC';

/** A thousands-separated integer that renders identically on server and
 * client. Returns an empty string for values that are not real numbers, so a
 * missing figure never reaches the page as "NaN". */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '';
  return new Intl.NumberFormat(NUMBER_LOCALE).format(numeric);
}

/** A medium-style date ("Jul 26, 2026") fixed to UTC. Returns an empty string
 * for an absent or unparseable timestamp rather than "Invalid Date". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    dateStyle: 'medium',
    timeZone: DATE_ZONE,
  }).format(date);
}

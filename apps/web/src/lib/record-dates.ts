/**
 * Dates on events and roles, read the one way everywhere they are shown.
 *
 * An event's times are printed in its own zone, and that zone is free text
 * an editor typed: one record with "Tokyo" in it threw a RangeError inside
 * Intl.DateTimeFormat and took the whole /events page down. Every format
 * that takes a record's zone goes through `formatIn`, which falls back to
 * the site's zone instead.
 *
 * Whether an event is upcoming, live or over, and whether a role is still
 * open, is decided here too, so a card, a page and a filter never disagree.
 */

/** The site's own zone: the API's default for an event, and the fallback. */
export const SITE_TIME_ZONE = 'Asia/Kolkata';

const instant = (value: unknown): Date | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const at = new Date(value as string);
  return Number.isNaN(at.getTime()) ? null : at;
};

export { instant as toInstant };

/** Whether the runtime knows this zone. */
export function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-IN', { timeZone: zone.trim() });
    return true;
  } catch {
    return false;
  }
}

/** The record's zone when it is one, else the site's. */
export function eventZone(zone: unknown): string {
  return validZone(zone) ? zone.trim() : SITE_TIME_ZONE;
}

/**
 * Intl.DateTimeFormat in a record's zone that cannot throw on a bad zone:
 * a RangeError is answered in the site's zone instead.
 */
export function formatIn(
  value: unknown,
  options: Intl.DateTimeFormatOptions,
  zone?: string | null,
  locale = 'en-IN',
): string | null {
  const at = instant(value);
  if (!at) return null;
  try {
    return new Intl.DateTimeFormat(locale, { ...options, ...(zone ? { timeZone: zone } : {}) }).format(at);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: SITE_TIME_ZONE }).format(at);
  }
}

/* Locales whose short zone names are letters, tried in turn: India's for
   IST, Britain's for BST and CET, America's for EST, Japan's for JST. */
const ZONE_NAME_LOCALES = ['en-IN', 'en-GB', 'en-US', 'en-AU', 'en-CA', 'en-NZ', 'en-IE', 'ja-JP'];

/** The zone's short name at that moment ("JST", "BST"), or its offset ("GMT+8"). */
export function zoneAbbreviation(value: unknown, zone: unknown): string | null {
  const at = instant(value);
  if (!at) return null;
  const timeZone = eventZone(zone);
  let offset: string | null = null;
  for (const locale of ZONE_NAME_LOCALES) {
    const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value;
    if (!name) continue;
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    offset ??= name;
  }
  return offset;
}

/** "20 Nov 2026" in the record's zone. */
export const eventDay = (value: unknown, zone?: string | null) => formatIn(value, { dateStyle: 'medium' }, zone);

/** "20 Nov 2026, 6:00 pm" in the record's zone. */
export const eventDateTime = (value: unknown, zone?: string | null) =>
  formatIn(value, { dateStyle: 'medium', timeStyle: 'short' }, zone);

/** "6:00 pm JST": the clock time with the zone it is in. */
export function eventClock(value: unknown, zone?: unknown): string | null {
  const time = formatIn(value, { timeStyle: 'short' }, eventZone(zone));
  if (!time) return null;
  const name = zoneAbbreviation(value, zone);
  return name ? `${time} ${name}` : time;
}

/** "6:00 pm – 7:30 pm JST", or the start alone. */
export function eventClockRange(starts: unknown, ends: unknown, zone?: unknown): string | null {
  const from = formatIn(starts, { timeStyle: 'short' }, eventZone(zone));
  if (!from) return null;
  const sameDay = eventDay(starts, eventZone(zone)) === eventDay(ends, eventZone(zone));
  const to = instant(ends) && sameDay ? formatIn(ends, { timeStyle: 'short' }, eventZone(zone)) : null;
  const name = zoneAbbreviation(starts, zone);
  return `${to ? `${from} – ${to}` : from}${name ? ` ${name}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/* The index signature lets any record row stand in for its times. */
export type EventTimes = { startsAt?: unknown; endsAt?: unknown; timezone?: unknown; [field: string]: unknown };

/**
 * Only the times, for the status badge the browser keeps current: handing
 * it the whole record sent every event's description, SEO and relations to
 * the browser a second time, once per card.
 */
export function eventTimes(row: EventTimes): EventTimes {
  return { startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone };
}

/** When an event is over: its end, or its start when it has no end. */
export function eventEnds(row: EventTimes): Date | null {
  return instant(row.endsAt) ?? instant(row.startsAt);
}

/** Over once its end (or, with no end, its start) has passed. */
export function eventEnded(row: EventTimes, now: Date | number = Date.now()): boolean {
  const end = eventEnds(row);
  return end ? end.getTime() < +now : false;
}

export type EventStatus = 'upcoming' | 'live' | 'today' | 'ended';

/**
 * Upcoming; live while it runs; today when it starts later on the same day
 * in its own zone; ended once over. The same rule splits /events into its
 * upcoming and past bands.
 */
export function eventStatus(row: EventTimes, now: Date | number = Date.now()): EventStatus | null {
  const starts = instant(row.startsAt);
  if (!starts) return null;
  if (eventEnded(row, now)) return 'ended';
  /* Started and not over: it is running. */
  if (starts.getTime() <= +now) return 'live';
  const zone = eventZone(row.timezone);
  if (eventDay(starts, zone) === eventDay(new Date(+now), zone)) return 'today';
  return 'upcoming';
}

export const EVENT_STATUS: Record<EventStatus, { label: string; badge: string }> = {
  upcoming: { label: 'Upcoming', badge: 'badge--ok' },
  live: { label: 'Live now', badge: 'badge--req' },
  today: { label: 'Today', badge: 'badge--req' },
  ended: { label: 'Ended', badge: 'badge--neutral' },
};

/**
 * Upcoming events soonest first, then past ones newest first: the page's own
 * split, so it holds whatever order the API sends.
 */
export function splitEvents<T extends EventTimes>(rows: readonly T[], now: Date | number = Date.now()) {
  const time = (row: T) => instant(row.startsAt)?.getTime() ?? 0;
  const upcoming = rows.filter((row) => !eventEnded(row, now)).sort((a, b) => time(a) - time(b));
  const past = rows.filter((row) => eventEnded(row, now)).sort((a, b) => time(b) - time(a));
  return { upcoming, past };
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

/** The UTC calendar date, as the API stores a role's closing day. */
export function utcDay(value: unknown): string | null {
  return instant(value)?.toISOString().slice(0, 10) ?? null;
}

/**
 * Closed once its closing day is over: the closing day's UTC date is
 * earlier than today's. The list keeps a role through its whole closing
 * day, so the page, the card and the list agree.
 */
export function jobClosed(expiryDate: unknown, now: Date | number = Date.now()): boolean {
  const closes = utcDay(expiryDate);
  const today = utcDay(new Date(+now));
  return Boolean(closes && today && closes < today);
}

/** Whole days from today to the closing day, both UTC dates. */
export function daysToClose(expiryDate: unknown, now: Date | number = Date.now()): number | null {
  const closes = utcDay(expiryDate);
  const today = utcDay(new Date(+now));
  if (!closes || !today) return null;
  return Math.round((Date.parse(`${closes}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** The zip's window for "Closing soon" (assets/js/scholarships.js). */
export const CLOSING_SOON_DAYS = 21;

export type JobStatus = 'open' | 'soon' | 'closed';

/** Open, Closing soon within 21 days, or Closed; nothing when no date is set. */
export function jobStatus(expiryDate: unknown, now: Date | number = Date.now()): JobStatus | null {
  const days = daysToClose(expiryDate, now);
  if (days === null) return null;
  if (days < 0) return 'closed';
  return days <= CLOSING_SOON_DAYS ? 'soon' : 'open';
}

export const JOB_STATUS: Record<JobStatus, { label: string; badge: string }> = {
  open: { label: 'Open', badge: 'badge--ok' },
  soon: { label: 'Closing soon', badge: 'badge--req' },
  closed: { label: 'Closed', badge: 'badge--neutral' },
};

/** A role's closing day, "1 Jan 2025", read as the UTC date it is stored as. */
export const jobDay = (value: unknown) => formatIn(value, { dateStyle: 'medium' }, 'UTC');

/* ------------------------------------------------------------------ */
/* Employment type and working pattern                                 */
/* ------------------------------------------------------------------ */

const squash = (value: unknown) => (typeof value === 'string' ? value.toLowerCase().replace(/[\s_-]+/g, '') : '');

const EMPLOYMENT: Record<string, { label: string; schema: string }> = {
  fulltime: { label: 'Full time', schema: 'FULL_TIME' },
  parttime: { label: 'Part time', schema: 'PART_TIME' },
  contract: { label: 'Contract', schema: 'CONTRACTOR' },
  contractor: { label: 'Contract', schema: 'CONTRACTOR' },
  internship: { label: 'Internship', schema: 'INTERN' },
  intern: { label: 'Internship', schema: 'INTERN' },
  temporary: { label: 'Temporary', schema: 'TEMPORARY' },
  temp: { label: 'Temporary', schema: 'TEMPORARY' },
};

/** schema.org's employmentType for what an editor wrote, or nothing when unknown. */
export function employmentSchema(value: unknown): string | undefined {
  return EMPLOYMENT[squash(value)]?.schema;
}

const humanise = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

/** One label for each type however it was typed: FULL_TIME, Full-time, full time → "Full time". */
export function employmentLabel(value: unknown): string | null {
  return EMPLOYMENT[squash(value)]?.label ?? humanise(value);
}

const WORKING: Record<string, string> = { onsite: 'On site', inoffice: 'On site', office: 'On site', hybrid: 'Hybrid', remote: 'Remote' };

/** "On site", "Hybrid" or "Remote", however it was typed. */
export function workingLabel(value: unknown): string | null {
  return WORKING[squash(value)] ?? humanise(value);
}

/** Whether a role is worked remotely, for JobPosting's TELECOMMUTE. */
export function remoteRole(value: unknown): boolean {
  return squash(value) === 'remote';
}

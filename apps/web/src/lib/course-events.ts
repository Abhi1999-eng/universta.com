/**
 * An event as the /courses "Upcoming events" strip prints it: its date and
 * time in the event's own zone, its format, its place and whether it can
 * still be registered for.
 *
 * The strip used to write every date in UTC, so an event at 01:00 in Tokyo
 * showed the day before on /courses and the right day on /events. The zone
 * is free text an editor typed, and a mistyped one ("Tokyo") would throw a
 * RangeError inside Intl.DateTimeFormat, so every format here falls back to
 * the site's zone, Asia/Kolkata, as the events pages do.
 *
 * The events pages carry their own card (t4's EventCards); folding the two
 * into one is a follow-up. Until then the rules here are the same ones.
 */

/** The site's own zone: the API's default for an event, and the fallback. */
export const SITE_TIME_ZONE = 'Asia/Kolkata';

type Row = Record<string, unknown>;

const words = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const nameOf = (value: unknown) =>
  value && typeof value === 'object' ? words((value as { name?: unknown }).name) : null;

function instant(value: unknown): Date | null {
  const raw = words(value);
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The event's zone when the runtime knows it, else the site's. */
export function eventZone(zone: unknown): string {
  const raw = words(zone);
  if (!raw) return SITE_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: raw });
    return raw;
  } catch {
    return SITE_TIME_ZONE;
  }
}

function formatIn(at: Date, options: Intl.DateTimeFormatOptions, zone: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: zone }).format(at);
  } catch {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: SITE_TIME_ZONE }).format(at);
  }
}

/* Locales whose short zone names are letters, tried in turn: India's for
   IST, Britain's for BST, America's for EST, Japan's for JST. */
const ZONE_NAME_LOCALES = ['en-IN', 'en-GB', 'en-US', 'en-AU', 'en-CA', 'en-NZ', 'en-IE', 'ja-JP'];

/** The zone's short name at that moment ("JST", "IST"), or its offset ("GMT+8"). */
export function zoneAbbreviation(at: Date, zone: string): string | null {
  let offset: string | null = null;
  for (const locale of ZONE_NAME_LOCALES) {
    let name: string | undefined;
    try {
      name = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(at)
        .find((part) => part.type === 'timeZoneName')?.value;
    } catch {
      return null;
    }
    if (!name) continue;
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    offset ??= name;
  }
  return offset;
}

/** "28 Oct 2026", in the event's zone. */
export function eventDate(startsAt: unknown, zone: unknown): string | null {
  const at = instant(startsAt);
  return at ? formatIn(at, { dateStyle: 'medium' }, eventZone(zone), 'en-GB') : null;
}

/** "6:00 pm JST": the clock time with the zone it is in. */
export function eventTime(startsAt: unknown, zone: unknown): string | null {
  const at = instant(startsAt);
  if (!at) return null;
  const timeZone = eventZone(zone);
  const time = formatIn(at, { timeStyle: 'short' }, timeZone, 'en-IN');
  const name = zoneAbbreviation(at, timeZone);
  return name ? `${time} ${name}` : time;
}

/* The design's names for the formats an editor picks from. */
const FORMAT_LABELS: Record<string, string> = {
  WEBINAR: 'Webinar',
  INFO_SESSION: 'Info session',
  WORKSHOP: 'Workshop',
  FAIR: 'Fair',
  OPEN_DAY: 'Open day',
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
};

/** "Webinar", from the event's type; "Online" for an untyped one with a link. */
export function eventFormat(eventType: unknown, onlineUrl?: unknown): string | null {
  const raw = words(eventType)?.toUpperCase().replace(/[\s-]+/g, '_');
  if (raw)
    return FORMAT_LABELS[raw] ?? raw.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return words(onlineUrl) ? 'Online' : null;
}

/** Where it happens: the venue, city and state each once, or "Online". */
export function eventWhere(row: Row): string | null {
  const parts: string[] = [];
  for (const part of [words(row.venue), nameOf(row.city), nameOf(row.state)])
    if (part && !parts.some((seen) => seen.toLowerCase() === part.toLowerCase())) parts.push(part);
  const country = nameOf(row.country)?.toLowerCase();
  const place = parts.filter((part) => part.toLowerCase() !== country).join(', ');
  if (place) return place;
  return nameOf(row.country) ? null : words(row.onlineUrl) ? 'Online' : null;
}

/** Over once its end (or, with no end, its start) has passed. */
export function eventEnded(row: Row, now: number): boolean {
  const ends = instant(row.endsAt) ?? instant(row.startsAt);
  return Boolean(ends && ends.getTime() < now);
}

export type StripEvent = {
  name: string;
  slug: string;
  /** The format, for the card's badge. */
  mode: string | null;
  startAt: string | null;
  /** In the event's own zone. Optional: an older caller sends none. */
  date?: string | null;
  time?: string | null;
  format?: string | null;
  where?: string | null;
  country?: { name: string; iso2: string | null } | null;
  /** Only while the event has not ended. */
  registerUrl?: string | null;
};

/** One event row from the API as the strip's card reads it. */
export function toStripEvent(row: Row, now: number): StripEvent {
  const country =
    row.country && typeof row.country === 'object' ? (row.country as Row) : null;
  const format = eventFormat(row.eventType, row.onlineUrl);
  const register = words(row.registrationUrl);
  return {
    name: String(row.title ?? row.name),
    slug: String(row.slug),
    mode: format,
    startAt: words(row.startsAt),
    date: eventDate(row.startsAt, row.timezone),
    time: eventTime(row.startsAt, row.timezone),
    format,
    where: eventWhere(row),
    country: nameOf(country)
      ? { name: nameOf(country)!, iso2: words(country?.iso2Code)?.toUpperCase() ?? null }
      : null,
    registerUrl:
      register && /^https?:\/\//i.test(register) && !eventEnded(row, now) ? register : null,
  };
}

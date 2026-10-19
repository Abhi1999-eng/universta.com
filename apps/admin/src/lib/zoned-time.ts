/**
 * A `datetime-local` input holds a wall-clock time with no zone: "18:00 on
 * 5 November". The API stores an instant. Handing it the bare wall time left
 * the API to read it in whatever zone its own server ran in, and the form read
 * stored instants back by cutting the ISO string at the minute -- which is UTC.
 * Between the two, every save moved the time by the server's offset.
 *
 * These two functions convert in a stated zone instead, so what an editor
 * types is the time in that zone, what they see on opening the record is the
 * same time, and an unchanged save keeps every instant as it was.
 */

/** The zone every admin date is read in when a record names none. */
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

/** Whether an Intl formatter accepts this as an IANA time zone. */
export function isTimeZone(zone: string | null | undefined): zone is string {
  if (!zone || !zone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone.trim() });
    return true;
  } catch {
    return false;
  }
}

/** The zone to convert in: the given one when it is real, else the default. */
export function zoneOrDefault(zone: string | null | undefined): string {
  return isTimeZone(zone) ? zone.trim() : DEFAULT_TIME_ZONE;
}

const WALL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** How far ahead of UTC the zone's clocks are at this instant, in ms. */
function offsetAt(instant: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "2026-11-05T18:00" in Asia/Tokyo -> "2026-11-05T09:00:00.000Z".
 * Returns '' for an empty value, and the value unchanged when it is not a
 * wall time at all, so the API's own validation names the problem.
 */
export function wallTimeToUtcIso(wall: string, zone: string): string {
  const value = wall.trim();
  if (!value) return '';
  const match = WALL.exec(value);
  if (!match) return value;
  const [, y, mo, d, h, mi, s] = match;
  const asUtc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? 0),
  );
  const tz = zoneOrDefault(zone);
  /* The offset depends on the instant, which is what is being worked out:
     guess with the offset at the wall time read as UTC, then correct once
     for a guess that landed on the other side of a clock change. */
  const first = asUtc - offsetAt(asUtc, tz);
  const second = asUtc - offsetAt(first, tz);
  return new Date(second).toISOString();
}

/**
 * "2026-11-05T09:00:00.000Z" in Asia/Tokyo -> "2026-11-05T18:00", for a
 * `datetime-local` input. Returns '' for an empty or unreadable value.
 */
export function utcIsoToWallTime(iso: string | null | undefined, zone: string): string {
  if (!iso) return '';
  const instant = new Date(iso).getTime();
  if (Number.isNaN(instant)) return '';
  const local = new Date(instant + offsetAt(instant, zoneOrDefault(zone)));
  return local.toISOString().slice(0, 16);
}

/** Every IANA zone this browser knows, for a pick list. */
export function timeZoneNames(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  const names = supported ? supported('timeZone') : [];
  /* Some engines list Kolkata under its older name only. */
  return [...new Set([...names, DEFAULT_TIME_ZONE, 'UTC'])].sort();
}

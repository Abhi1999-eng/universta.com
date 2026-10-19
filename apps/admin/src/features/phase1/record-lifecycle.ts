import { DEFAULT_TIME_ZONE, zoneOrDefault } from '@/lib/zoned-time';

/**
 * What a row in a Phase 1 list cannot say with "Published" alone.
 *
 * A published record can still be off the site: scheduled to go live later,
 * or past the end of its publishing window -- the list said "Published" with
 * a "View on site" link that answered 404. A role whose closing date has
 * passed is closed, and an event that has finished has ended; both pages
 * still answer, but an editor scanning the list should not have to open each
 * one to find out.
 */

export type LifecycleRow = {
  status?: string | null;
  publishStartsAt?: string | null;
  publishEndsAt?: string | null;
  expiryDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string | null;
};

export type LifecycleNote = {
  label: string;
  tone: 'scheduled' | 'neutral';
};

function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** "1 Dec 2026, 10:00", in the zone given. */
export function formatDateTime(value: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zoneOrDefault(zone),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

/** The start of today's UTC calendar date, as the API and the site judge a
 * role's closing day. */
function startOfUtcDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * The notes to show beside a row's status, and whether its public page is
 * live now (which decides "View on site").
 */
export function lifecycle(
  resource: string,
  row: LifecycleRow,
  now: Date = new Date(),
): { notes: LifecycleNote[]; live: boolean } {
  const notes: LifecycleNote[] = [];
  let live = row.status === 'PUBLISHED';
  const at = now.getTime();
  if (row.status === 'PUBLISHED') {
    const starts = instant(row.publishStartsAt);
    const ends = instant(row.publishEndsAt);
    if (starts !== null && starts > at) {
      /* Publishing windows are typed in India's time. */
      notes.push({
        label: `Scheduled (goes live ${formatDateTime(row.publishStartsAt as string, DEFAULT_TIME_ZONE)} IST)`,
        tone: 'scheduled',
      });
      live = false;
    } else if (ends !== null && ends <= at) {
      notes.push({ label: 'Expired', tone: 'neutral' });
      live = false;
    }
  }
  if (resource === 'jobs') {
    /* A role stays open through the whole of its closing day (UTC). */
    const closes = instant(row.expiryDate);
    if (closes !== null && closes < startOfUtcDay(now))
      notes.push({ label: 'Closed', tone: 'neutral' });
  }
  if (resource === 'events') {
    /* Over once it has finished: its end, or its start when it has none. */
    const over = instant(row.endsAt) ?? instant(row.startsAt);
    if (over !== null && over < at) notes.push({ label: 'Ended', tone: 'neutral' });
  }
  return { notes, live };
}

/** How a testimonial reads in a list: the opening of its quote, and who said it. */
export function testimonialName(quote: string, attribution?: string | null): string {
  const text = quote.replace(/\s+/g, ' ').trim();
  const snippet = text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
  const who = attribution?.trim();
  return who ? `${snippet} — ${who}` : snippet;
}

'use client';

import { useSyncExternalStore } from 'react';
import { EVENT_STATUS, eventStatus, formatIn, zoneAbbreviation, type EventTimes } from '@/lib/record-dates';

/**
 * The parts of an event that depend on when, and where, it is read.
 *
 * The page is drawn on the server with the server's clock, and a cached or
 * long-open page would go on saying "Upcoming" after an event had started.
 * As the zip's statusFor() does, the badge is worked out again in the
 * browser, from the same rule, and kept current by the minute. The reader's
 * own clock time is added in the browser too, since only it knows the zone.
 */

const subscribeMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Now, to the minute: the server's moment while hydrating, the browser's after. */
export function useNow(serverNow: number) {
  return useSyncExternalStore(subscribeMinute, minute, () => serverNow);
}

export function EventStatusBadge({ event, serverNow }: { event: EventTimes; serverNow: number }) {
  const now = useNow(serverNow);
  const status = eventStatus(event, now);
  if (!status) return null;
  const { label, badge } = EVENT_STATUS[status];
  return <span className={`badge ${badge}`}>{label}</span>;
}

const noSubscribe = () => () => {};
const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/**
 * "Your time" -- the start in the reader's own zone, where that differs
 * from the event's. Nothing on the server, which cannot know the reader.
 */
export function LocalTime({ startsAt, zone }: { startsAt: unknown; zone: string }) {
  const local = useSyncExternalStore(noSubscribe, browserZone, () => null);
  if (!local) return null;
  const theirs = formatIn(startsAt, { dateStyle: 'medium', timeStyle: 'short' }, zone);
  const yours = formatIn(startsAt, { dateStyle: 'medium', timeStyle: 'short' }, local);
  const name = zoneAbbreviation(startsAt, local);
  /* The reader is in the event's zone already: nothing to add. */
  if (!yours || (yours === theirs && name === zoneAbbreviation(startsAt, zone))) return null;
  return (
    <div className="deadlinecard__row">
      <span className="label">Your time</span>
      <span>{name ? `${yours} ${name}` : yours}</span>
    </div>
  );
}

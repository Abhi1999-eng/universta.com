import Link from 'next/link';
import type { ReactNode } from 'react';
import { EventStatusBadge } from './EventClock';
import { eventFormat, type EventItem } from '@/lib/event-filters';
import { plainExcerpt, plainText } from '@/lib/record-text';
import { eventClock, eventDay, eventEnded, eventZone, formatIn, toInstant } from '@/lib/record-dates';

/**
 * An event as a card, in the zip's scholarship-card shape: the format badge
 * and a live status at the top, the title (whose link covers the card), the
 * summary, the date, time, format and place, and the way in. Register sits
 * above the card's own link, so it is a link of its own and never a link
 * inside a link.
 */

/* Media come from the site's own media route or approved asset hosts. */
/* eslint-disable @next/next/no-img-element */

type Row = Record<string, unknown> & { id: string };
/** Country slugs with a published guide: only those are linked. */
export type Guides = ReadonlySet<string>;

const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const nameOf = (value: unknown) => (value && typeof value === 'object' ? words((value as { name?: unknown }).name) : null);

export const eventHref = (row: Row) => `/events/${encodeURIComponent(String(row.slug ?? row.id))}`;

export type EventCountry = { name: string; slug: string | null; iso2: string | null };

/**
 * Where an event happens: the venue, city and state each said once, and the
 * country apart, for its chip. An online event with no place says so.
 */
export function eventPlace(row: Row): {
  /** Venue, city and state, or "Online" for an online event with no place. */
  text: string | null;
  /** Venue, city and state only: somewhere a person can go. */
  place: string | null;
  country: EventCountry | null;
} {
  const parts: string[] = [];
  for (const part of [words(row.venue), nameOf(row.city), nameOf(row.state)]) {
    if (part && !parts.some((seen) => seen.toLowerCase() === part.toLowerCase())) parts.push(part);
  }
  const country = row.country && typeof row.country === 'object' ? (row.country as Record<string, unknown>) : null;
  const countryName = words(country?.name);
  /* A venue that is the country's name again ("Japan") is said once, by the chip. */
  const place = parts.filter((part) => part.toLowerCase() !== countryName?.toLowerCase()).join(', ') || null;
  const online = eventFormat(row.eventType, row.onlineUrl)?.value === 'ONLINE' || (!place && !countryName && words(row.onlineUrl));
  return {
    text: place ?? (online ? 'Online' : null),
    place,
    country: countryName
      ? { name: countryName, slug: words(country?.slug), iso2: words(country?.iso2Code)?.toUpperCase() ?? null }
      : null,
  };
}

/** The country as the zip's flag chip, linked to its guide where one is published. */
export function CountryChip({ country, guides }: { country: EventCountry; guides?: Guides }) {
  const inner = (
    <>
      {country.iso2 ? <span className="flagchip__code">{country.iso2}</span> : null}
      {country.name}
    </>
  );
  return country.slug && guides?.has(country.slug) ? (
    <Link className="flagchip" href={`/study-abroad/${encodeURIComponent(country.slug)}`}>
      {inner}
    </Link>
  ) : (
    <span className="flagchip">{inner}</span>
  );
}

/** "Shibuya Hall, Tokyo" and the Japan chip, or "Online" (unless only a real place is wanted). */
export function EventPlace({ row, guides, physical }: { row: Row; guides?: Guides; physical?: boolean }): ReactNode {
  const where = eventPlace(row);
  const text = physical ? where.place : where.text;
  const country = where.country;
  if (!text && !country) return null;
  return (
    <span className="eventplace">
      {text ? <span>{text}</span> : null}
      {country ? <CountryChip country={country} guides={guides} /> : null}
    </span>
  );
}

/** The event's own image, as a card thumbnail or a hero picture. */
export function eventImage(row: Row): { src: string; alt: string } | null {
  const media = row.featuredMedia as { publicUrl?: unknown; altText?: unknown; title?: unknown } | null | undefined;
  const src = words(media?.publicUrl);
  return src ? { src, alt: words(media?.altText) ?? words(row.title) ?? '' } : null;
}

export function EventCard({ row, guides, now }: { row: Row; guides?: Guides; now: number }) {
  const href = eventHref(row);
  const zone = eventZone(row.timezone);
  const format = eventFormat(row.eventType, row.onlineUrl);
  const date = eventDay(row.startsAt, zone);
  const time = eventClock(row.startsAt, row.timezone);
  const summary = plainExcerpt(row.summary, 180) ?? plainExcerpt(row.description, 180, 'event', row);
  const place = eventPlace(row);
  const register = words(row.registrationUrl);
  const ended = eventEnded(row, now);
  const image = eventImage(row);
  return (
    <article className="schcard eventcard">
      {image ? (
        <span className="eventcard__media">
          <img src={image.src} alt={image.alt} loading="lazy" />
        </span>
      ) : null}
      <div className="schcard__top">
        {format ? <span className="fundbadge">{format.label}</span> : <span />}
        <EventStatusBadge event={row} serverNow={now} />
      </div>
      <h3 className="schcard__name">
        <Link className="eventcard__link" href={href}>
          {words(row.title) ?? 'Event'}
        </Link>
      </h3>
      {summary ? <p className="schcard__note">{summary}</p> : null}
      <dl className="schcard__facts">
        {date ? (
          <div>
            <dt>Date</dt>
            <dd>{date}</dd>
          </div>
        ) : null}
        {time ? (
          <div>
            <dt>Time</dt>
            <dd>{time}</dd>
          </div>
        ) : null}
        {format ? (
          <div>
            <dt>Format</dt>
            <dd>{format.label}</dd>
          </div>
        ) : null}
        {place.text || place.country ? (
          <div>
            <dt>Where</dt>
            <dd>
              <EventPlace row={row} guides={guides} />
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="schcard__foot">
        {/* The title's link covers the card; this is how it looks, not a second link. */}
        <span className="btn btn--sm" aria-hidden="true">
          View event{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </span>
        {register && !ended ? (
          <a className="btn btn--sm btn--ghost eventcard__register" href={register} rel="nofollow noopener" target="_blank">
            Register{' '}
            <span className="btn__arrow" aria-hidden="true">
              &#8599;
            </span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** One event as the /events filters read it, with its card. */
export function eventItem(row: Row, guides: Guides | undefined, now: number): EventItem & { node: ReactNode } {
  const place = eventPlace(row);
  const format = eventFormat(row.eventType, row.onlineUrl);
  return {
    key: row.id,
    title: words(row.title) ?? '',
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    text: [words(row.title), plainText(row.summary), place.text, place.country?.name, format?.label].filter(Boolean).join(' '),
    format,
    country: place.country ? { value: place.country.slug ?? place.country.name, label: place.country.name } : null,
    node: <EventCard row={row} guides={guides} now={now} />,
  };
}

/** The next event to start that has not ended, or none. */
export function nextEvent(rows: readonly Row[], now: number): Row | null {
  const ahead = rows
    .filter((row) => toInstant(row.startsAt) && !eventEnded(row, now))
    .sort((a, b) => toInstant(a.startsAt)!.getTime() - toInstant(b.startsAt)!.getTime());
  return ahead[0] ?? null;
}

/**
 * The /events hero's right half: the next event, with its date as a block,
 * its title, format and place, and the ways in.
 */
export function NextEventCard({ row, guides, now }: { row: Row; guides?: Guides; now: number }) {
  const href = eventHref(row);
  const zone = eventZone(row.timezone);
  const format = eventFormat(row.eventType, row.onlineUrl);
  const register = words(row.registrationUrl);
  const dayNumber = formatIn(row.startsAt, { day: 'numeric' }, zone);
  const month = formatIn(row.startsAt, { month: 'short' }, zone);
  const year = formatIn(row.startsAt, { year: 'numeric' }, zone);
  return (
    <aside className="nextevent" aria-label="Next event">
      <div className="nextevent__head">
        <span className="label">Next event</span>
        <EventStatusBadge event={row} serverNow={now} />
      </div>
      <div className="nextevent__body">
        <span className="nextevent__date" aria-hidden="true">
          <b>{dayNumber}</b>
          <span>{month}</span>
          <span>{year}</span>
        </span>
        <div className="nextevent__what">
          <h2 className="nextevent__t">
            <Link href={href}>{words(row.title) ?? 'Event'}</Link>
          </h2>
          <p className="nextevent__m">{[eventDay(row.startsAt, zone), eventClock(row.startsAt, row.timezone)].filter(Boolean).join(' · ')}</p>
          {format ? <p className="nextevent__m">{format.label}</p> : null}
          <p className="nextevent__m">
            <EventPlace row={row} guides={guides} />
          </p>
        </div>
      </div>
      <div className="btn-row">
        <Link className="btn btn--sm" href={href}>
          View event{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
        {register ? (
          <a className="btn btn--sm btn--ghost" href={register} rel="nofollow noopener" target="_blank">
            Register{' '}
            <span className="btn__arrow" aria-hidden="true">
              &#8599;
            </span>
          </a>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * Up to `count` upcoming events to show beside this one: the same format
 * or country first, then soonest; never this event, never one that is over.
 */
export function moreEvents(current: Row, rows: readonly Row[], now: number, count = 4): Row[] {
  const format = eventFormat(current.eventType, current.onlineUrl)?.value ?? null;
  const country = eventPlace(current).country?.slug ?? null;
  const near = (row: Row) =>
    (format && eventFormat(row.eventType, row.onlineUrl)?.value === format) || (country && eventPlace(row).country?.slug === country) ? 0 : 1;
  const time = (row: Row) => toInstant(row.startsAt)?.getTime() ?? 0;
  return rows
    .filter(
      (row) =>
        row.id !== current.id && (!current.slug || row.slug !== current.slug) && toInstant(row.startsAt) && !eventEnded(row, now),
    )
    .sort((a, b) => near(a) - near(b) || time(a) - time(b))
    .slice(0, count);
}

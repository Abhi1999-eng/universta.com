import { eventFormat } from './event-filters';
import { plainText } from './record-text';
import { absoluteCanonical } from './seo-management';

/**
 * An event page's schema.org Event.
 *
 * The description is plain text with the editor's {eventTitle}, {eventDate}
 * and {eventVenue} filled in, not the editor's HTML. An in-person event's
 * Place carries a PostalAddress from the venue, city, state and country, as
 * search engines ask of one; an online or hybrid event keeps its
 * VirtualLocation. The event's own picture is its image. eventStatus stays
 * EventScheduled: schema.org has no "completed", and an event held as
 * planned was scheduled.
 */

type Row = Record<string, unknown>;

const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const nameOf = (value: unknown) => (value && typeof value === 'object' ? words((value as { name?: unknown }).name) : null);

/** Drops the keys a record left empty, so the JSON-LD carries no nulls. */
function defined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)) as T;
}

/** The venue, city, state and country as a PostalAddress, or none when the record names none of them. */
export function postalAddress(row: Row) {
  const country = row.country && typeof row.country === 'object' ? (row.country as Row) : null;
  const address = defined({
    streetAddress: words(row.venue) ?? undefined,
    addressLocality: nameOf(row.city) ?? undefined,
    addressRegion: nameOf(row.state) ?? undefined,
    addressCountry: words(country?.iso2Code)?.toUpperCase() ?? nameOf(country) ?? undefined,
  });
  return Object.keys(address).length ? { '@type': 'PostalAddress', ...address } : undefined;
}

export function eventJsonLd(row: Row) {
  const format = eventFormat(row.eventType, row.onlineUrl)?.value;
  const isOnline = format === 'ONLINE';
  const isHybrid = format === 'HYBRID';
  const address = postalAddress(row);
  const placeName = words(row.venue) ?? nameOf(row.city) ?? nameOf(row.state) ?? nameOf(row.country);
  const venue = placeName || address ? defined({ '@type': 'Place', name: placeName ?? undefined, address }) : undefined;
  const online = words(row.onlineUrl);
  const virtual = online ? { '@type': 'VirtualLocation', url: online } : undefined;
  const location = isHybrid ? [venue, virtual].filter(Boolean) : isOnline ? virtual : venue;
  const media = row.featuredMedia as { publicUrl?: unknown } | null | undefined;
  const image = words(media?.publicUrl);
  return defined({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: row.title,
    description: plainText(row.description, 'event', row) ?? plainText(row.summary) ?? words(row.title) ?? undefined,
    startDate: row.startsAt,
    endDate: row.endsAt ?? undefined,
    eventAttendanceMode: isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : isHybrid
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: Array.isArray(location) && !location.length ? undefined : location,
    image: image ? absoluteCanonical(image) : undefined,
    organizer: { '@type': 'Organization', name: 'Universta' },
  });
}

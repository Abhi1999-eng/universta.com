import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText } from '@/components/phase1/RichText';
import { jsonLdString } from '@/lib/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/university-json-ld';
import { Crumbs } from './Crumbs';
import { ConnectBand } from './DiscoveryBands';
import { day, facts, name, plain, StoryCard, text, type DirectoryRow } from './RecordDirectory';
import { EventCard, EventPlace, eventImage, eventPlace, type Guides } from './EventCards';
import { EventStatusBadge, LocalTime } from './EventClock';
import { initials, QuoteByline } from './QuoteCard';
import { SectionHead } from './SectionHead';
import { eventFormat } from '@/lib/event-filters';
import {
  employmentLabel,
  eventClock,
  eventClockRange,
  eventDateTime,
  eventDay,
  eventEnded,
  eventTimes,
  eventZone,
  JOB_STATUS,
  jobClosed,
  jobDay,
  jobStatus,
  workingLabel,
} from '@/lib/record-dates';
import { plainText } from '@/lib/record-text';
import { programmePath } from '@/lib/success-story';
import { resolveContentVariables } from '../../../../../packages/content-variables';

/**
 * A career, an event or a success story on its own page, in the approved
 * design: the compact hero with what the record states beside the title,
 * the record's own prose, and the connect band. These are the three record
 * types the zip does not draw, so they borrow the shape of its award and
 * profile pages. A field the record does not hold is left out, not dashed.
 */

/* Section media can come from approved external asset hosts, same as elsewhere in this app. */
/* eslint-disable @next/next/no-img-element */

type Cell = { label: string; value: ReactNode };

function Snapshot({ cells }: { cells: Array<Cell | null> }) {
  const shown = cells.filter((cell): cell is Cell => Boolean(cell && cell.value));
  if (!shown.length) return null;
  return (
    <div className="unisnap unisnap--fit" style={{ marginTop: 26 }}>
      {shown.map((cell) => (
        <div className="unisnap__cell" key={cell.label}>
          <span className="label">{cell.label}</span>
          <b>{cell.value}</b>
        </div>
      ))}
    </div>
  );
}

/**
 * A band of the record's own prose, in the zip's split head: the eyebrow
 * and title on the left, held while the band scrolls, and the prose in the
 * column beside them, as the level pages' bands do. On a phone they stack.
 */
function Prose({ eyebrow, title, value, lead }: { eyebrow: string; title: string; value: string | null; lead?: string }) {
  if (!value) return null;
  return (
    <section className="sec sec--white recordband" id={eyebrow.toLowerCase().replace(/\W+/g, '-')}>
      <div className="wrap">
        <SectionHead eyebrow={eyebrow} title={title} lead={lead}>
          <RichText value={value} className="h-prose" />
        </SectionHead>
      </div>
    </section>
  );
}

function Hero({
  trail,
  self,
  eyebrow,
  title,
  sub,
  note,
  actions,
  cells,
  aside,
  media,
}: {
  trail: Crumb[];
  self: string;
  eyebrow: string | null;
  title: string;
  sub: string | null;
  note?: string | null;
  actions: ReactNode;
  cells: Array<Cell | null>;
  /** The right half of the hero: a role's closing date, an event's time. */
  aside?: ReactNode;
  /** The record's own picture, under the title and its buttons. */
  media?: ReactNode;
}) {
  const lead = (
    <>
      {eyebrow ? <p className="hero__eyebrow">{eyebrow}</p> : null}
      <h1 className="hero__h1">{title}</h1>
      {sub ? <p className="hero__sub">{sub}</p> : null}
      {note ? <p className="examtests__note">{note}</p> : null}
      <div className="btn-row" style={{ marginTop: 22 }}>
        {actions}
      </div>
    </>
  );
  const picture = media ? <figure className="recordhero__media">{media}</figure> : null;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(trail, self)) }} />
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={trail} />
          {/* The picture follows the date card on a phone, and sits under
              the title beside it on a wide screen. */}
          {aside ? (
            <div className="coursehero__grid recordhero">
              <div>{lead}</div>
              <div className="recordhero__aside">{aside}</div>
              {picture}
            </div>
          ) : (
            <div className="hero__lead">
              {lead}
              {picture}
            </div>
          )}
          <Snapshot cells={cells} />
        </div>
      </section>
    </>
  );
}

/** "20 Nov 2026, 6:00 pm" in the event's zone; the site's when that zone is mistyped. */
const when = (value: unknown, timeZone?: string | null) => eventDateTime(value, timeZone);

const counselling = (self: string) => `/counselling?source=general&from=${encodeURIComponent(self)}`;

/** "Role: <title>", for the contact form's Subject, so the enquiry names the role. */
export const roleEnquiryHref = (title: string) => `/contact?subject=${encodeURIComponent(`Role: ${title}`)}`;

/** An email address that may break after its "@" and the dots of its
 *  domain, and nowhere inside a word. */
function Mail({ address }: { address: string }) {
  const at = address.indexOf('@');
  const domain = at > 0 ? address.slice(at + 1).split(/(?<=\.)/) : [];
  return (
    <a className="unisnap__mail" href={`mailto:${address}`}>
      {at > 0
        ? [address.slice(0, at + 1), ...domain].map((part, index) => (
            <span key={index}>
              {index ? <wbr /> : null}
              {part}
            </span>
          ))
        : address}
    </a>
  );
}

/**
 * The hero's right half on a role page, in the zip's deadline card: the
 * closing date large, whether the role is open, closing soon or closed (by
 * the UTC date, as the list decides), when it was posted, and the way to
 * apply while it is open.
 */
function JobDeadline({ row, now, apply }: { row: DirectoryRow; now: number; apply: ReactNode }) {
  const closes = jobDay(row.expiryDate);
  const status = JOB_STATUS[jobStatus(row.expiryDate, now) ?? 'open'];
  const posted = jobDay(row.publishedDate);
  return (
    <aside className="deadlinecard" aria-label="Applications close">
      <span className="label">Applications close</span>
      {closes ? <b className="deadlinecard__date datum">{closes}</b> : <b className="deadlinecard__varies">No closing date set</b>}
      <div className="deadlinecard__row">
        <span className="label">Status</span>
        <span className={`badge ${status.badge}`}>{status.label}</span>
      </div>
      {posted ? (
        <div className="deadlinecard__row">
          <span className="label">Posted</span>
          <span>{posted}</span>
        </div>
      ) : null}
      {apply}
    </aside>
  );
}

export function JobGuide({ row, now = new Date().getTime() }: { row: DirectoryRow; now?: number }) {
  const self = `/careers/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Role';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Careers', href: '/careers' }, { label: title }];
  /* A closed role keeps its page, so a shared link still explains itself,
     but no longer invites an application. */
  const closed = jobClosed(row.expiryDate, now);
  const applyUrl = closed ? null : text(row.applicationUrl);
  const applyEmail = closed ? null : text(row.applicationEmail);
  /* A role's free-text location is usually its city again, so each place is said once. */
  const where = facts(
    ...[text(row.location), name(row.city), name(row.state), name(row.country)].filter(
      (part, index, all) => part && all.findIndex((other) => other?.toLowerCase() === part.toLowerCase()) === index,
    ),
  );
  const closes = jobDay(row.expiryDate);
  const type = employmentLabel(row.employmentType);
  const working = workingLabel(row.remoteStatus);
  const resolve = (value: unknown) => {
    const resolved = text(value) ? resolveContentVariables('job', String(value), row) : null;
    return resolved && plainText(resolved) ? resolved : null;
  };
  const description = resolve(row.description);
  const apply = (size: 'lg' | 'block') =>
    applyUrl ? (
      <a className={size === 'lg' ? 'btn btn--lg' : 'btn btn--block'} href={applyUrl} rel="nofollow noopener" target="_blank">
        Apply for this role{' '}
        <span className="btn__arrow" aria-hidden="true">
          &#8599;
        </span>
      </a>
    ) : applyEmail ? (
      <a className={size === 'lg' ? 'btn btn--lg' : 'btn btn--block'} href={`mailto:${applyEmail}`}>
        Apply by email{' '}
        <span className="btn__arrow" aria-hidden="true">
          &rarr;
        </span>
      </a>
    ) : null;
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Role', text(row.department), type, working) || 'Role'}
        title={title}
        sub={plain(row.summary, 400) ?? (description ? null : 'Universta has published this role without a summary.')}
        note={closed && closes ? `Applications for this role closed on ${closes}.` : null}
        aside={<JobDeadline row={row} now={now} apply={apply('block')} />}
        actions={
          <>
            {apply('lg')}
            <Link className={`btn btn--lg${applyUrl || applyEmail ? ' btn--ghost' : ''}`} href="/careers">
              All open roles
            </Link>
            <Link className="btn btn--lg btn--ghost" href={roleEnquiryHref(title)}>
              Ask about this role
            </Link>
          </>
        }
        cells={[
          where ? { label: 'Location', value: where } : null,
          working ? { label: 'Working', value: working } : null,
          type ? { label: 'Type', value: type } : null,
          text(row.department) ? { label: 'Department', value: text(row.department) } : null,
          closes ? { label: 'Applications close', value: closes } : null,
          applyEmail ? { label: 'Apply by email', value: <Mail address={applyEmail} /> } : null,
        ]}
      />
      <Prose eyebrow="Overview" title="About the role" value={description} />
      <Prose eyebrow="Role details" title="Responsibilities" value={resolve(row.responsibilities)} />
      <Prose eyebrow="Requirements" title="Qualifications" value={resolve(row.qualifications)} />
      <ConnectBand
        actions={[
          { href: '/careers', label: 'All open roles' },
          { href: '/about', label: 'About Universta', ghost: true },
          { href: '/contact', label: 'Contact', ghost: true },
        ]}
      />
    </>
  );
}

/** A speaker as the editor typed them: a name, or a record carrying one. */
function speakerNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const name = text(entry) ?? (entry && typeof entry === 'object' ? text((entry as { name?: unknown }).name) : null);
    return name ? [name] : [];
  });
}

/**
 * The hero's right half on an event page, in the zip's dark deadline card:
 * the date large, the time in the event's own zone and, added in the
 * reader's browser, in theirs; whether it is upcoming, running or over; and
 * Register while it is still to come.
 */
function EventWhen({ row, ended, now }: { row: DirectoryRow; ended: boolean; now: number }) {
  const zone = eventZone(row.timezone);
  const date = eventDay(row.startsAt, zone);
  const sameDay = !text(row.endsAt) || eventDay(row.endsAt, zone) === date;
  const time = eventClockRange(row.startsAt, row.endsAt, zone);
  const registration = text(row.registrationUrl);
  return (
    <aside className="deadlinecard eventwhen" aria-label="When">
      <span className="label">When</span>
      {date ? <b className="deadlinecard__date datum">{date}</b> : <b className="deadlinecard__varies">Date to be announced</b>}
      {time ? (
        <div className="deadlinecard__row">
          <span className="label">{sameDay ? 'Time' : 'Starts'}</span>
          <span>{sameDay ? time : eventClock(row.startsAt, zone)}</span>
        </div>
      ) : null}
      {!sameDay ? (
        <div className="deadlinecard__row">
          <span className="label">Ends</span>
          <span>{facts(eventDay(row.endsAt, zone), eventClock(row.endsAt, zone))}</span>
        </div>
      ) : null}
      {date ? <LocalTime startsAt={row.startsAt} zone={zone} /> : null}
      {date ? (
        <div className="deadlinecard__row">
          <span className="label">Status</span>
          <EventStatusBadge event={eventTimes(row)} serverNow={now} />
        </div>
      ) : null}
      {registration && !ended ? (
        <a className="btn btn--block" href={registration} rel="nofollow noopener" target="_blank">
          Register{' '}
          <span className="btn__arrow" aria-hidden="true">
            &#8599;
          </span>
        </a>
      ) : null}
    </aside>
  );
}

export function EventGuide({
  row,
  more = [],
  guides,
  now = new Date().getTime(),
}: {
  row: DirectoryRow;
  /** Upcoming events to show after this one (moreEvents). */
  more?: DirectoryRow[];
  /** Country slugs with a published guide, for the place's flag chip. */
  guides?: Guides;
  /** The moment the page is drawn for: a test pins it. */
  now?: number;
}) {
  const self = `/events/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Event';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Events', href: '/events' }, { label: title }];
  /* The zone every time on the page is printed in: the event's own, or the
     site's when the editor's is not a zone ("Tokyo"), so the Time zone cell
     never names a zone the times are not in. */
  const zone = eventZone(row.timezone);
  const registration = text(row.registrationUrl);
  const online = text(row.onlineUrl);
  const format = eventFormat(row.eventType, row.onlineUrl)?.label ?? null;
  const place = eventPlace(row);
  /* The editor's {eventTitle}, {eventDate} and {eventVenue}, filled in as a
     role's and a story's are; an emptied editor is no description. */
  const resolved = text(row.description) ? resolveContentVariables('event', String(row.description), row) : null;
  const description = resolved && plainText(resolved) ? resolved : null;
  const starts = when(row.startsAt, zone);
  const speakers = speakerNames(row.speakersJson);
  const image = eventImage(row);
  /* Whether it has already happened, by its end (its start when it has none),
     the rule the /events bands and the badge follow. */
  const past = eventEnded(row, now);
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Event', day(row.startsAt, zone), format) || 'Event'}
        title={title}
        sub={plain(row.summary, 400)}
        note={past ? 'This event has already taken place.' : null}
        aside={<EventWhen row={row} ended={past} now={now} />}
        media={image ? <img src={image.src} alt={image.alt} /> : null}
        actions={
          <>
            {registration && !past ? (
              <a className="btn btn--lg" href={registration} rel="nofollow noopener" target="_blank">
                Register{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            ) : null}
            {online && !past ? (
              <a className="btn btn--lg btn--ghost" href={online} rel="nofollow noopener" target="_blank">
                Join online{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            ) : null}
            <Link className={`btn btn--lg${(registration || online) && !past ? ' btn--ghost' : ''}`} href="/events">
              All events
            </Link>
            <Link className="btn btn--lg btn--ghost" href={counselling(self)}>
              Talk to a counsellor
            </Link>
          </>
        }
        cells={[
          starts ? { label: 'Starts', value: starts } : null,
          when(row.endsAt, zone) ? { label: 'Ends', value: when(row.endsAt, zone) } : null,
          text(row.timezone) ? { label: 'Time zone', value: zone.replace(/_/g, ' ') } : null,
          format ? { label: 'Format', value: format } : null,
          place.place || place.country
            ? { label: text(row.venue) ? 'Venue' : 'Location', value: <EventPlace row={row} guides={guides} physical /> }
            : null,
        ]}
      />
      <Prose eyebrow="Overview" title="About this event" value={description} />
      {speakers.length ? (
        <section className="sec sec--paper sec--tight h-sec" id="speakers">
          <div className="wrap">
            <div className="h-head">
              <p className="eyebrow">Event information</p>
              <h2 className="sec-title">Speakers</h2>
            </div>
            <ul className="speakers">
              {speakers.map((speaker, index) => (
                <li className="speakers__card" key={`${speaker}-${index}`}>
                  <span className="quote__init" aria-hidden="true">
                    {initials(speaker)}
                  </span>
                  <strong>{speaker}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {more.length ? (
        <section className="sec sec--white sec--tight h-sec" id="more-events">
          <div className="wrap">
            <div className="h-head">
              <p className="eyebrow eyebrow--plain">What is on next</p>
              <h2 className="sec-title">More upcoming events</h2>
            </div>
            <div className={more.length === 3 ? 'schgrid schgrid--3' : 'schgrid'}>
              {more.map((event) => (
                <EventCard row={event} guides={guides} now={now} key={event.id} />
              ))}
            </div>
            <p className="h-more">
              <Link className="linkcta" href="/events">
                All events <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}
      <ConnectBand
        actions={[
          { href: '/events', label: 'All events' },
          { href: counselling(self), label: 'Book free counselling', ghost: true },
          { href: '/study-abroad', label: 'Compare destinations', ghost: true },
        ]}
      />
    </>
  );
}

export function StoryGuide({ row, more = [] }: { row: DirectoryRow; more?: DirectoryRow[] }) {
  const self = `/success-stories/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Success story';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Success stories', href: '/success-stories' }, { label: title }];
  const country = row.country as { name?: unknown; slug?: unknown } | null | undefined;
  const university = row.university as { name?: unknown; slug?: unknown } | null | undefined;
  const offering = row.offering as
    | {
        name?: unknown;
        slug?: unknown;
        university?: { slug?: unknown; country?: { slug?: unknown } | null } | null;
        genericCourse?: { name?: unknown; slug?: unknown } | null;
      }
    | null
    | undefined;
  const media = row.featuredMedia as { publicUrl?: unknown; altText?: unknown; title?: unknown } | null | undefined;
  const programme = text(offering?.name) ?? text(offering?.genericCourse?.name);
  const programmeHref = programmePath({
    offering: offering
      ? {
          slug: text(offering.slug),
          university: offering.university
            ? { slug: text(offering.university.slug), country: { slug: text(offering.university.country?.slug) } }
            : null,
          genericCourse: { slug: text(offering.genericCourse?.slug) },
        }
      : null,
  });
  const related: Array<{ label: string; value: string; href: string | null }> = [
    text(country?.name) ? { label: 'Study destination', value: String(country!.name), href: text(country?.slug) ? `/study-abroad/${encodeURIComponent(String(country!.slug))}` : null } : null,
    text(university?.name) ? { label: 'University', value: String(university!.name), href: text(university?.slug) ? `/universities/${encodeURIComponent(String(university!.slug))}` : null } : null,
    programme ? { label: 'Programme', value: programme, href: programmeHref } : null,
  ].filter((entry): entry is { label: string; value: string; href: string | null } => Boolean(entry));
  const resolved = text(row.journey) ? resolveContentVariables('successStory', String(row.journey), row) : null;
  /* An emptied editor saves "<p><br></p>": that is a story with no text, not
     an empty "How it went" band. */
  const journey = resolved && plainText(resolved) ? resolved : null;
  const attribution = text(row.attribution);
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Success story', text(country?.name), text(university?.name)) || 'Success story'}
        title={title}
        sub={attribution}
        note={text(row.attributionNote)}
        actions={
          <>
            <Link className="btn btn--lg" href="/success-stories">
              More stories{' '}
              <span className="btn__arrow" aria-hidden="true">
                &rarr;
              </span>
            </Link>
            <Link className="btn btn--lg btn--ghost" href={counselling(self)}>
              Plan a similar journey
            </Link>
          </>
        }
        cells={[]}
      />
      {/* The zip's hub article: the story in a reading column, and beside it,
          held in view as the reader scrolls, who told it and a way to plan
          the same move. On a phone the card follows the story. */}
      <section className="sec sec--white" id="journey">
        <div className="wrap h-article">
          <div className="h-article__main">
            <div className="h-head">
              <p className="eyebrow">The journey</p>
              <h2 className="sec-title">How it went</h2>
            </div>
            {text(media?.publicUrl) ? (
              <figure className="h-figure" style={{ marginBottom: 24 }}>
                <img src={String(media!.publicUrl)} alt={text(media?.altText) ?? text(media?.title) ?? title} />
              </figure>
            ) : null}
            {journey ? (
              <>
                <RichText value={journey} className="h-prose" />
                <p className="h-note">
                  This is one student’s own account. Entry requirements, costs and visa timelines change from year to
                  year, so check the details on the university’s official website before you plan around them.
                </p>
              </>
            ) : (
              <p className="examtests__note">The story has been published without its text.</p>
            )}
            {related.length ? (
              <div className="h-grid h-grid--4" style={{ marginTop: 30 }}>
                {related.map((entry) =>
                  entry.href ? (
                    <Link className="h-card" href={entry.href} key={entry.label}>
                      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
                        {entry.label}
                      </span>
                      <strong className="h-card__t">{entry.value}</strong>
                    </Link>
                  ) : (
                    <div className="h-card" key={entry.label}>
                      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
                        {entry.label}
                      </span>
                      <strong className="h-card__t">{entry.value}</strong>
                    </div>
                  ),
                )}
              </div>
            ) : null}
          </div>
          <aside className="h-aside" aria-label="About this story">
            <div className="h-card">
              {attribution ? <QuoteByline as="div" name={attribution} note={text(row.attributionNote)} /> : null}
              <strong className="h-card__t">Planning something similar?</strong>
              <span className="h-card__d">
                A Universta counsellor can talk through the destination, the application and the timeline with you.
              </span>
              <Link className="btn btn--sm" href={counselling(self)}>
                Plan a similar journey
              </Link>
            </div>
          </aside>
        </div>
      </section>
      {more.length ? (
        <section className="sec sec--paper sec--tight h-sec" id="more-stories">
          <div className="wrap">
            <div className="h-head">
              <p className="eyebrow eyebrow--plain">Student journeys</p>
              <h2 className="sec-title">More success stories</h2>
            </div>
            <div className="h-grid h-grid--4">
              {more.map((story) => (
                <StoryCard row={story} key={story.id} />
              ))}
            </div>
            <p className="h-more">
              <Link className="linkcta" href="/success-stories">
                All success stories <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}
      <ConnectBand
        actions={[
          { href: '/courses', label: 'Explore courses' },
          { href: counselling(self), label: 'Book free counselling', ghost: true },
          ...(text(country?.slug) ? [{ href: `/study-abroad/${encodeURIComponent(String(country!.slug))}`, label: `Study in ${String(country!.name)}`, ghost: true }] : []),
          { href: '/success-stories', label: 'All success stories', ghost: true },
        ]}
      />
    </>
  );
}

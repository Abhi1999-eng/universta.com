import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText } from '@/components/phase1/RichText';
import { jsonLdString } from '@/lib/json-ld';
import { breadcrumbJsonLd, type Crumb } from '@/lib/university-json-ld';
import { Crumbs } from './Crumbs';
import { ConnectBand } from './DiscoveryBands';
import { day, facts, humanise, name, plain, text, type DirectoryRow } from './RecordDirectory';
import { SectionHead } from './SectionHead';
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

function Prose({ eyebrow, title, value, lead }: { eyebrow: string; title: string; value: string | null; lead?: string }) {
  if (!value) return null;
  return (
    <section className="sec sec--white" id={eyebrow.toLowerCase().replace(/\W+/g, '-')}>
      <div className="wrap">
        <SectionHead eyebrow={eyebrow} title={title} lead={lead} />
        <RichText value={value} className="h-prose" />
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
}: {
  trail: Crumb[];
  self: string;
  eyebrow: string | null;
  title: string;
  sub: string | null;
  note?: string | null;
  actions: ReactNode;
  cells: Array<Cell | null>;
}) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(trail, self)) }} />
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={trail} />
          <div className="hero__lead">
            {eyebrow ? <p className="hero__eyebrow">{eyebrow}</p> : null}
            <h1 className="hero__h1">{title}</h1>
            {sub ? <p className="hero__sub">{sub}</p> : null}
            {note ? <p className="examtests__note">{note}</p> : null}
            <div className="btn-row" style={{ marginTop: 22 }}>
              {actions}
            </div>
          </div>
          <Snapshot cells={cells} />
        </div>
      </section>
    </>
  );
}

const when = (value: unknown, timeZone?: string | null) => {
  const raw = text(value);
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(at);
};

const counselling = (self: string) => `/counselling?source=general&from=${encodeURIComponent(self)}`;

export function JobGuide({ row }: { row: DirectoryRow }) {
  const self = `/careers/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Role';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Careers', href: '/careers' }, { label: title }];
  const applyUrl = text(row.applicationUrl);
  const applyEmail = text(row.applicationEmail);
  /* A role's free-text location is usually its city again, so each place is said once. */
  const where = facts(...[text(row.location), name(row.city), name(row.state), name(row.country)].filter((part, index, all) => part && all.indexOf(part) === index));
  const closes = day(row.expiryDate);
  const description = text(row.description);
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Role', text(row.department), humanise(row.employmentType), humanise(row.remoteStatus)) || 'Role'}
        title={title}
        sub={plain(row.summary, 400) ?? (description ? null : 'Universta has published this role without a summary.')}
        actions={
          <>
            {applyUrl ? (
              <a className="btn btn--lg" href={applyUrl} rel="nofollow noopener" target="_blank">
                Apply on the official site{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &#8599;
                </span>
              </a>
            ) : applyEmail ? (
              <a className="btn btn--lg" href={`mailto:${applyEmail}`}>
                Apply by email{' '}
                <span className="btn__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </a>
            ) : null}
            <Link className={`btn btn--lg${applyUrl || applyEmail ? ' btn--ghost' : ''}`} href="/careers">
              All open roles
            </Link>
            <Link className="btn btn--lg btn--ghost" href="/contact">
              Ask about this role
            </Link>
          </>
        }
        cells={[
          where ? { label: 'Location', value: where } : null,
          humanise(row.remoteStatus) ? { label: 'Working', value: humanise(row.remoteStatus) } : null,
          humanise(row.employmentType) ? { label: 'Type', value: humanise(row.employmentType) } : null,
          text(row.department) ? { label: 'Department', value: text(row.department) } : null,
          closes ? { label: 'Applications close', value: closes } : null,
          applyEmail ? { label: 'Apply by email', value: <a href={`mailto:${applyEmail}`}>{applyEmail}</a> } : null,
        ]}
      />
      <Prose eyebrow="Overview" title="About the role" value={description} />
      <Prose eyebrow="Role details" title="Responsibilities" value={text(row.responsibilities) ? resolveContentVariables('job', String(row.responsibilities), row) : null} />
      <Prose eyebrow="Requirements" title="Qualifications" value={text(row.qualifications) ? resolveContentVariables('job', String(row.qualifications), row) : null} />
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

export function EventGuide({ row }: { row: DirectoryRow }) {
  const self = `/events/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Event';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Events', href: '/events' }, { label: title }];
  const zone = text(row.timezone);
  const registration = text(row.registrationUrl);
  const online = text(row.onlineUrl);
  const format = humanise(row.eventType);
  const venue = text(row.venue) ?? name(row.city);
  const description = text(row.description);
  const starts = when(row.startsAt, zone);
  /* Whether it has already happened, judged once here on the server. */
  const now = new Date();
  const past = text(row.endsAt ?? row.startsAt) ? new Date(String(row.endsAt ?? row.startsAt)).getTime() < now.getTime() : false;
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Event', day(row.startsAt, zone), format) || 'Event'}
        title={title}
        sub={plain(row.summary, 400)}
        note={past ? 'This event has already taken place.' : null}
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
          zone ? { label: 'Time zone', value: zone.replace(/_/g, ' ') } : null,
          format ? { label: 'Format', value: format } : online ? { label: 'Format', value: 'Online' } : null,
          venue ? { label: 'Venue', value: venue } : null,
        ]}
      />
      <Prose eyebrow="Overview" title="About this event" value={description} />
      {row.speakersJson ? (
        <section className="sec sec--paper" id="speakers">
          <div className="wrap">
            <SectionHead eyebrow="Event information" title="Speakers" lead="Speaker details are provided in the official event listing." />
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

export function StoryGuide({ row }: { row: DirectoryRow }) {
  const self = `/success-stories/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const title = text(row.title) ?? 'Success story';
  const trail: Crumb[] = [{ label: 'Home', href: '/' }, { label: 'Success stories', href: '/success-stories' }, { label: title }];
  const country = row.country as { name?: unknown; slug?: unknown } | null | undefined;
  const university = row.university as { name?: unknown; slug?: unknown } | null | undefined;
  const offering = row.offering as
    | { name?: unknown; slug?: unknown; university?: { slug?: unknown } | null; genericCourse?: { name?: unknown; slug?: unknown } | null }
    | null
    | undefined;
  const media = row.featuredMedia as { publicUrl?: unknown; altText?: unknown; title?: unknown } | null | undefined;
  const programme = text(offering?.name) ?? text(offering?.genericCourse?.name);
  const programmeHref =
    text(offering?.slug) && text(offering?.university?.slug)
      ? `/universities/${encodeURIComponent(String(offering!.university!.slug))}/courses/${encodeURIComponent(String(offering!.slug))}`
      : text(offering?.genericCourse?.slug)
        ? `/courses/${encodeURIComponent(String(offering!.genericCourse!.slug))}`
        : null;
  const related: Array<{ label: string; value: string; href: string | null }> = [
    text(country?.name) ? { label: 'Study destination', value: String(country!.name), href: text(country?.slug) ? `/study-abroad/${encodeURIComponent(String(country!.slug))}` : null } : null,
    text(university?.name) ? { label: 'University', value: String(university!.name), href: text(university?.slug) ? `/universities/${encodeURIComponent(String(university!.slug))}` : null } : null,
    programme ? { label: 'Programme', value: programme, href: programmeHref } : null,
  ].filter((entry): entry is { label: string; value: string; href: string | null } => Boolean(entry));
  const journey = text(row.journey) ? resolveContentVariables('successStory', String(row.journey), row) : null;
  return (
    <>
      <Hero
        trail={trail}
        self={self}
        eyebrow={facts('Success story', text(country?.name), text(university?.name)) || 'Success story'}
        title={title}
        sub={text(row.attribution)}
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
      <section className="sec sec--white" id="journey">
        <div className="wrap">
          <SectionHead eyebrow="The journey" title="How it went" />
          {text(media?.publicUrl) ? (
            <figure className="h-figure" style={{ marginBottom: 24 }}>
              <img src={String(media!.publicUrl)} alt={text(media?.altText) ?? text(media?.title) ?? title} />
            </figure>
          ) : null}
          {journey ? <RichText value={journey} className="h-prose" /> : <p className="examtests__note">The story has been published without its text.</p>}
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
      </section>
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

import Link from 'next/link';
import type { ReactNode } from 'react';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { Crumbs } from './Crumbs';
import { PlanBand } from './PlanBand';
import { QuoteCard, type QuoteImage } from './QuoteCard';
import { universityHref } from '@/lib/university-links';

/**
 * The approved design's directory page for careers, events, success stories
 * and testimonials. The zip draws testimonials itself -- its quote card on
 * the country guide -- and the testimonials page uses that card; the other
 * three borrow the shape of its other directories.
 *
 * These pages wore the older template -- its own header, a "Published
 * directory" hero promising "nothing here is placeholder content", and a grey
 * card grid -- while every page around them had moved to the design. They now
 * open with the design's compact hero, list their records as the design's
 * cards, and close on the same next-step band as the guides. A directory with
 * nothing published says so once, and offers counselling instead of a dead
 * end.
 */

export type DirectoryRow = Record<string, unknown> & { id: string };

type Props = {
  trail: string;
  eyebrow: string;
  title: string;
  lede: string;
  /** "role" / "roles", for the count line. */
  noun: [string, string];
  total: number;
  rows: DirectoryRow[];
  card: (row: DirectoryRow) => ReactNode;
  empty: { heading: string; body: string };
  /** The grid's column width: stories and quotes read better wider. */
  wide?: boolean;
  /** The grid's own class, where the cards need another layout ("quotes"). */
  grid?: string;
};

export function RecordDirectory({ trail, eyebrow, title, lede, noun, total, rows, card, empty, wide, grid }: Props) {
  const count = `${total} ${total === 1 ? noun[0] : noun[1]}`;
  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: trail }]} />
          <p className="hero__eyebrow">{eyebrow}</p>
          <h1 className="hero__h1">{title}</h1>
          <p className="hero__sub">{lede}</p>
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec" id="directory">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Published</p>
            <h2 className="sec-title">{count}</h2>
          </div>
          {rows.length ? (
            <div className={grid ?? (wide ? 'h-grid h-grid--wide' : 'h-grid')}>{rows.map((row) => card(row))}</div>
          ) : (
            <div className="h-empty h-empty--box">
              <h3>{empty.heading}</h3>
              <p>{empty.body}</p>
              <div className="btn-row">
                <Link className="btn" href="/counselling">
                  Book free counselling
                </Link>
                <Link className="btn btn--ghost" href="/study-abroad">
                  Browse destinations
                </Link>
              </div>
            </div>
          )}
          {rows.length && total > rows.length ? (
            <p className="h-card__m" style={{ marginTop: 16 }}>
              Showing {rows.length} of {total}.
            </p>
          ) : null}
        </div>
      </section>

      <PlanBand
        heading="Not sure where to start?"
        body="Tell us about your academic profile, goals and budget, and we'll help you understand your options."
        secondary={{ href: '/study-abroad', label: 'Browse destinations' }}
      />
    </>
  );
}

/** The same readings of a record's fields, for the record's own page. */
export const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Words from a field the editor wrote as rich text. */
export function plain(value: unknown, length = 180) {
  const raw = text(value);
  if (!raw) return null;
  const words = (/<[a-z][^>]*>/i.test(raw) ? richTextToPlainText(raw) : raw).replace(/\s+/g, ' ').trim();
  return words.length > length ? `${words.slice(0, length).trimEnd()}…` : words;
}

export function humanise(value: unknown) {
  const raw = text(value);
  return raw ? raw.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null;
}

export function day(value: unknown, timeZone?: string | null) {
  const raw = text(value);
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', ...(timeZone ? { timeZone } : {}) }).format(at);
}

export const name = (value: unknown) =>
  value && typeof value === 'object' && 'name' in value ? text((value as { name?: unknown }).name) : null;

export const facts = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' · ');

export function JobCard({ row }: { row: DirectoryRow }) {
  const href = `/careers/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const where = text(row.location) ?? name(row.city) ?? name(row.country);
  const closes = day(row.expiryDate);
  return (
    <Link className="h-card" href={href} key={row.id}>
      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
        {facts(text(row.department), humanise(row.employmentType), humanise(row.remoteStatus))}
      </span>
      <strong className="h-card__t">{text(row.title)}</strong>
      {plain(row.summary ?? row.description) ? <span className="h-card__d">{plain(row.summary ?? row.description)}</span> : null}
      <span className="h-card__m">{facts(where, closes ? `Closes ${closes}` : null)}</span>
      <span className="linkcta">
        View role <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

export function EventCard({ row }: { row: DirectoryRow }) {
  const href = `/events/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const zone = text(row.timezone);
  const when = day(row.startsAt, zone);
  const where = text(row.venue) ?? name(row.city) ?? (text(row.onlineUrl) ? 'Online' : null);
  return (
    <Link className="h-card" href={href} key={row.id}>
      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
        {facts(when, humanise(row.eventType))}
      </span>
      <strong className="h-card__t">{text(row.title)}</strong>
      {plain(row.summary ?? row.description) ? <span className="h-card__d">{plain(row.summary ?? row.description)}</span> : null}
      {where ? <span className="h-card__m">{where}</span> : null}
      <span className="linkcta">
        View event <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

export function StoryCard({ row }: { row: DirectoryRow }) {
  const href = `/success-stories/${encodeURIComponent(String(row.slug ?? row.id))}`;
  return (
    <Link className="h-card" href={href} key={row.id}>
      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
        {facts(name(row.country), name(row.university))}
      </span>
      <strong className="h-card__t">{text(row.title)}</strong>
      {plain(row.journey) ? <span className="h-card__d">{plain(row.journey)}</span> : null}
      {text(row.attribution) ? <span className="h-card__m">{text(row.attribution)}</span> : null}
      <span className="linkcta">
        Read the story <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

type Place = { name?: unknown; slug?: unknown } | null | undefined;

/**
 * Where a testimonial's student studied, as the muted line under the name:
 * the university (linked to its page), the course where it says more than
 * the university does, and the country. An offering's own name already ends
 * "... at <the university>", so the course is its general course's name.
 * Every relation is read defensively: an older API sends none of them.
 */
export function testimonialPlace(row: DirectoryRow): ReactNode {
  const offering = row.offering as { name?: unknown; university?: Place; genericCourse?: Place } | null | undefined;
  const university = (row.university as Place) ?? offering?.university;
  const universityName = text(university?.name);
  const universitySlug = text(university?.slug);
  const course = text(offering?.genericCourse?.name) ?? (universityName ? null : text(offering?.name));
  const country = text((row.country as Place)?.name);
  const parts: ReactNode[] = [
    universityName ? (
      universitySlug ? (
        <Link href={universityHref(universitySlug)} key="u">
          {universityName}
        </Link>
      ) : (
        universityName
      )
    ) : null,
    course,
    country && country !== universityName ? country : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return parts.map((part, index) => (index ? [' · ', part] : part));
}

/**
 * A quote has no page of its own, so its card is not a link, and the whole
 * quote is printed: cut at 400 characters, the rest could never be read.
 */
export function TestimonialCard({ row }: { row: DirectoryRow }) {
  const quote = text(row.quote);
  if (!quote) return null;
  return (
    <QuoteCard
      quote={quote}
      name={text(row.attribution)}
      note={text(row.attributionNote)}
      image={row.imageMedia as QuoteImage}
      extra={testimonialPlace(row)}
    />
  );
}

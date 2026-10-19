import Link from 'next/link';
import type { ReactNode } from 'react';
import { richTextToPlainText } from '@/components/phase1/RichText';
import { Crumbs } from './Crumbs';
import { PlanBand } from './PlanBand';
import { QuoteByline, QuoteCard, type QuoteImage } from './QuoteCard';
import { employmentLabel, formatIn, jobDay, jobStatus, workingLabel } from '@/lib/record-dates';
import { plainExcerpt, plainText } from '@/lib/record-text';
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
  /** The directory's own body in place of the plain grid -- a search box
   *  over the cards, or bands of them -- when there is anything to show. */
  body?: ReactNode;
  /** The right half of the hero, where the page has something to put there. */
  aside?: ReactNode;
};

export function RecordDirectory({ trail, eyebrow, title, lede, noun, total, rows, card, empty, wide, grid, body, aside }: Props) {
  const count = `${total} ${total === 1 ? noun[0] : noun[1]}`;
  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <Crumbs trail={[{ label: 'Home', href: '/' }, { label: trail }]} />
          {aside ? (
            <div className="coursehero__grid recordhero">
              <div>
                <p className="hero__eyebrow">{eyebrow}</p>
                <h1 className="hero__h1">{title}</h1>
                <p className="hero__sub">{lede}</p>
              </div>
              {aside}
            </div>
          ) : (
            <>
              <p className="hero__eyebrow">{eyebrow}</p>
              <h1 className="hero__h1">{title}</h1>
              <p className="hero__sub">{lede}</p>
            </>
          )}
        </div>
      </section>

      <section className="sec sec--white sec--tight h-sec" id="directory">
        <div className="wrap">
          <div className="h-head">
            <p className="eyebrow eyebrow--plain">Published</p>
            <h2 className="sec-title">{count}</h2>
          </div>
          {rows.length && body ? (
            body
          ) : rows.length ? (
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

/** "20 Nov 2026"; in a record's own zone when given, and never a crash on a
 *  zone an editor mistyped -- the site's zone answers instead. */
export function day(value: unknown, timeZone?: string | null) {
  return formatIn(value, { dateStyle: 'medium' }, timeZone);
}

export const name = (value: unknown) =>
  value && typeof value === 'object' && 'name' in value ? text((value as { name?: unknown }).name) : null;

export const facts = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' · ');

/**
 * A role as the /careers card shows it: its type as a pill at the top, the
 * team and working pattern, the title, the summary (or the description,
 * with its variables filled in), where it is, when it closes and when it
 * was posted, and "Closing soon" beside the date in its last 21 days.
 */
export function JobCard({ row, now = new Date().getTime() }: { row: DirectoryRow; now?: number }) {
  const href = `/careers/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const where = text(row.location) ?? name(row.city) ?? name(row.country);
  const closes = jobDay(row.expiryDate);
  const posted = jobDay(row.publishedDate);
  const type = employmentLabel(row.employmentType);
  const summary = plainExcerpt(row.summary, 180) ?? plainExcerpt(row.description, 180, 'job', row);
  const soon = jobStatus(row.expiryDate, now) === 'soon';
  return (
    <Link className="h-card jobcard" href={href} key={row.id}>
      {type ? <span className="fundbadge jobcard__type">{type}</span> : null}
      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
        {facts(text(row.department), workingLabel(row.remoteStatus))}
      </span>
      <strong className="h-card__t">{text(row.title)}</strong>
      {summary ? <span className="h-card__d">{summary}</span> : null}
      {where || closes || posted ? (
        <span className="h-card__m jobcard__when">
          {[
            where,
            closes ? (
              <span key="closes">
                Closes {closes}
                {soon ? (
                  <>
                    {' '}
                    <span className="badge badge--req">Closing soon</span>
                  </>
                ) : null}
              </span>
            ) : null,
            posted ? `Posted ${posted}` : null,
          ]
            .filter(Boolean)
            .map((part, index) => (index ? [' · ', part] : part))}
        </span>
      ) : null}
      <span className="linkcta">
        View role <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

/** What the role search matches: the title, the team and every place named. */
export const jobSearchText = (row: DirectoryRow) =>
  [text(row.title), text(row.department), text(row.location), name(row.city), name(row.state), name(row.country), employmentLabel(row.employmentType), workingLabel(row.remoteStatus)]
    .filter(Boolean)
    .join(' ');

/** A story's journey as its card shows it: variables filled in, as on the
 *  story's own page, then plain text cut to a short excerpt. */
export const storyExcerpt = (row: DirectoryRow, length = 180) => plainExcerpt(row.journey, length, 'successStory', row);

export function StoryCard({ row }: { row: DirectoryRow }) {
  const href = `/success-stories/${encodeURIComponent(String(row.slug ?? row.id))}`;
  const excerpt = storyExcerpt(row);
  const attribution = text(row.attribution);
  return (
    <Link className="h-card storycard" href={href} key={row.id}>
      <span className="h-card__m" style={{ marginTop: 0, paddingTop: 0 }}>
        {facts(name(row.country), name(row.university))}
      </span>
      <strong className="h-card__t">{text(row.title)}</strong>
      {excerpt ? <span className="h-card__d">{excerpt}</span> : null}
      {attribution ? <QuoteByline as="div" name={attribution} note={text(row.attributionNote)} /> : null}
      <span className="linkcta">
        Read the story <span className="linkcta__arrow" aria-hidden="true">&rarr;</span>
      </span>
    </Link>
  );
}

/** What the story search matches: title, student and the journey's words. */
export const storySearchText = (row: DirectoryRow) =>
  [text(row.title), text(row.attribution), text(row.attributionNote), name(row.country), name(row.university), plainText(row.journey, 'successStory', row)]
    .filter(Boolean)
    .join(' ');

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

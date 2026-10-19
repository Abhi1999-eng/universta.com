import type { ReactNode } from 'react';

/**
 * The zip's student-voice card (templates/partials/testimonials.html): a
 * faded quote mark, the words as given, a divider, then the student's
 * initials in a navy circle beside their name and a muted role line.
 *
 * The country guide, the testimonials page and the Website Builder's
 * Testimonials section all draw a testimonial this way, and a success story's
 * byline uses the same foot, so one student's voice looks the same wherever
 * it is quoted. Where an editor chose a photo, it takes the initials' place.
 * The markup keeps to the classes the stylesheet already draws, so the card
 * looks the same on any page that shows it.
 */

/* Media come from the site's own media route or approved asset hosts. */
/* eslint-disable @next/next/no-img-element */

export type QuoteImage = { publicUrl?: unknown; altText?: unknown; title?: unknown } | null | undefined;

const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The initials shown beside a quote, from whatever attribution it carries. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The round avatar: the editor's photo where there is one, else initials. */
export function QuoteAvatar({ name, image }: { name: string | null; image?: QuoteImage }) {
  const src = words(image?.publicUrl);
  if (src) {
    return (
      <span className="quote__init" style={{ overflow: 'hidden' }}>
        <img
          src={src}
          alt={words(image?.altText) ?? name ?? ''}
          loading="lazy"
          width={38}
          height={38}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      </span>
    );
  }
  if (!name) return null;
  return (
    <span className="quote__init" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/**
 * The foot of the card: avatar, name, role line and anything the record
 * links to. A quote with no attribution still keeps its foot when it has a
 * place to name, so the university line is not lost with the name.
 */
export function QuoteByline({
  name,
  note,
  image,
  extra,
  as: Tag = 'figcaption',
}: {
  name: string | null;
  note?: string | null;
  image?: QuoteImage;
  extra?: ReactNode;
  as?: 'figcaption' | 'div';
}) {
  const lines = [
    name ? <span className="quote__n" key="n">{name}</span> : null,
    note ? <span className="quote__r" key="r">{note}</span> : null,
    extra ? <span className="quote__r" key="x">{extra}</span> : null,
  ].filter(Boolean);
  if (!lines.length) return null;
  return (
    <Tag className="quote__by">
      <QuoteAvatar name={name} image={image} />
      <span>
        {lines.map((line, index) => (index ? [<br key={`br${index}`} />, line] : line))}
      </span>
    </Tag>
  );
}

/** One testimonial, whole: the full quote is printed, since it has no page of its own. */
export function QuoteCard({
  quote,
  name,
  note,
  image,
  extra,
}: {
  quote: string;
  name: string | null;
  note?: string | null;
  image?: QuoteImage;
  extra?: ReactNode;
}) {
  return (
    <figure className="quote">
      <span className="quote__mark" aria-hidden="true">
        “
      </span>
      <blockquote className="quote__t">{quote}</blockquote>
      <QuoteByline name={name} note={note} image={image} extra={extra} />
    </figure>
  );
}

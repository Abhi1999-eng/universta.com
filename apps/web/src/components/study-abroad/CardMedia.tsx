import type { Media } from '@/lib/catalog';

/**
 * A record's listing image, at the top of its card, where an editor set
 * one. The card's name says what it is, so the image is decoration and
 * carries no text of its own; a card without one is drawn as before.
 */
export function CardMedia({ media, className }: { media?: Media | null; className: string }) {
  if (!media?.url) return null;
  return (
    <span className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt="" loading="lazy" />
    </span>
  );
}

/** The design's "Popular" mark, for a record an editor has featured. */
export function PopularBadge({ featured }: { featured?: boolean | null }) {
  return featured ? <span className="badge badge--req">Popular</span> : null;
}

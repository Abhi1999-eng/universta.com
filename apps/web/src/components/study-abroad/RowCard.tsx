import Link from 'next/link';

/**
 * A card that is a link, and looks like one.
 *
 * The grids of subjects and specializations were boxes with a name in them.
 * Every one of them opened a page, and nothing on the box said so: no arrow,
 * no count of what was inside, and a hover that only darkened a hairline.
 * This is the same box with the two things a reader uses to decide whether
 * to press it -- what is in there, and that it goes somewhere.
 *
 * It is the row card the destination's subjects page already used, lifted
 * out so the guide and the pages under it show a subject the same way
 * wherever it appears.
 */
const SKIP = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

/** "Health & Medicine" reads as HM rather than H&. */
export function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** "18 specializations", or nothing when there are none to count. */
export function countLabel(count: number | null | undefined, noun: string) {
  if (!count) return null;
  return `${count.toLocaleString('en-GB')} ${noun}${count === 1 ? '' : 's'}`;
}

export function RowCard({
  href,
  title,
  meta = null,
  mark = false,
}: {
  href: string;
  title: string;
  /** What is inside: "18 specializations", "6 courses". */
  meta?: string | null;
  /** The title's initials in a tile, for a grid of subjects. */
  mark?: boolean;
}) {
  return (
    <Link className="h-card h-card--row" href={href}>
      {mark ? (
        <span className="unimark unimark--xs" aria-hidden="true">
          {initials(title)}
        </span>
      ) : null}
      <span className="h-card__body">
        <span className="h-card__t">{title}</span>
        {meta ? <span className="h-card__m">{meta}</span> : null}
      </span>
      <span className="h-card__go" aria-hidden="true">
        &rarr;
      </span>
    </Link>
  );
}

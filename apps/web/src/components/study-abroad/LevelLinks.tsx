import Link from 'next/link';
import { Fragment } from 'react';
import type { LevelLink } from '@/lib/subject-levels';

/**
 * A field's level pages, linked: "Master's" opens
 * `/subjects/computing/masters`, or `/subjects/computing/ai/masters` from a
 * specialization. The links come from `levelPageLinks`, so they are the
 * levels the field is offered at and nothing else -- never a 404, never the
 * noindex `?view=guides` copy.
 *
 * Two looks. `chips`, under a page's heading: the level page's own
 * "Specializations at Master's" row, one chip per level. `inline`, on a
 * card: the levels line the card already printed, each name now a link.
 * The visible text stays the level's name; the accessible name says whose
 * level it is ("Master's in Data Science"), since a list of cards reads as
 * a run of identical "Master's" links otherwise.
 *
 * Draws nothing when there are no links.
 */
export function LevelLinks({
  links,
  field,
  variant = 'inline',
  label,
}: {
  links: readonly LevelLink[];
  /** The subject's or specialization's name, for the accessible names. */
  field: string;
  variant?: 'chips' | 'inline';
  /** The chips' heading, as the level page heads its own chips. */
  label?: string;
}) {
  if (!links.length) return null;
  const name = (link: LevelLink) => `${link.name} in ${field}`;

  if (variant === 'chips') {
    return (
      /* Not called "Study levels": the courses-by-level bar further down
         already is, and the two would answer to one name. */
      <nav className="specchips levelchips" aria-label={`${field} by level`}>
        {label ? <span className="label">{label}</span> : null}
        <ul className="specchips__row" role="list">
          {links.map((link) => (
            <li key={link.code}>
              <Link className="specchip" href={link.href} aria-label={name(link)}>
                {link.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  /* Spans, not a list: the line sits inside a card's `<p>` or `<span>`. */
  return (
    <span className="levellinks">
      {links.map((link, index) => (
        <Fragment key={link.code}>
          {index ? <span aria-hidden="true">, </span> : null}
          <Link className="levellinks__a" href={link.href} aria-label={name(link)}>
            {link.name}
          </Link>
        </Fragment>
      ))}
    </span>
  );
}

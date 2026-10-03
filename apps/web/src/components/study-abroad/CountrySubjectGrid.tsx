'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * Every field taught in one destination, with a box to narrow them.
 *
 * Thirty subjects is past the number anybody scans. The filter runs in the
 * browser because the whole list is already here -- a destination has tens
 * of subjects, not thousands -- so typing costs no request and the result
 * is instant.
 *
 * It is a plain input rather than a form: there is no results page to
 * submit to, and a box that looks like a search and then reloads the page
 * to show the same thirty cards is worse than no box.
 */

export type CountrySubjectCard = {
  id: string;
  name: string;
  slug: string;
  /** How many specializations the field holds; omitted when none. */
  specializations: number;
};

const SKIP = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

/** "Health & Medicine" reads as HM rather than H&. */
function initials(value: string) {
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

function card(subject: CountrySubjectCard, countrySlug: string) {
  return (
    <Link
      className="h-card h-card--row"
      href={`/study-abroad/${countrySlug}/${subject.slug}`}
      key={subject.id}
    >
      <span className="unimark unimark--xs" aria-hidden="true">
        {initials(subject.name)}
      </span>
      <span className="h-card__body">
        <span className="h-card__t">{subject.name}</span>
        {subject.specializations ? (
          <span className="h-card__m">
            {subject.specializations} specialization
            {subject.specializations === 1 ? '' : 's'}
          </span>
        ) : null}
      </span>
      <span className="h-card__go" aria-hidden="true">
        &rarr;
      </span>
    </Link>
  );
}

export function CountrySubjectGrid({
  taught,
  editorial,
  countrySlug,
  emptyLabel,
  note = null,
}: {
  /** Fields a published course is actually taught in. */
  taught: CountrySubjectCard[];
  /** Fields an editor listed for a market the catalogue has not reached. */
  editorial: CountrySubjectCard[];
  countrySlug: string;
  /** Said when the filter matches nothing, naming what was searched. */
  emptyLabel: string;
  /** Said once above the grid when none of these is recorded against the
   * destination -- the list is the catalogue's rather than its own. */
  note?: string | null;
}) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  /* One box over both lists. The two are shown apart -- a derived field
     opens on something, an editorial one may not -- but a reader typing
     "engin" is asking the page a single question. */
  const match = useCallback(
    (rows: CountrySubjectCard[]) =>
      term ? rows.filter((row) => row.name.toLowerCase().includes(term)) : rows,
    [term],
  );
  const shownTaught = useMemo(() => match(taught), [taught, match]);
  const shownEditorial = useMemo(() => match(editorial), [editorial, match]);
  const total = taught.length + editorial.length;
  const found = shownTaught.length + shownEditorial.length;

  return (
    <>
      {total > 8 ? (
        <div className="bigsearch bigsearch--sm subjfilter">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="bigsearch__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subjects…"
            aria-label="Search subjects"
            autoComplete="off"
          />
        </div>
      ) : null}

      {note ? <p className="h-more subjnote">{note}</p> : null}

      {shownTaught.length ? (
        <div className="h-grid">{shownTaught.map((subject) => card(subject, countrySlug))}</div>
      ) : null}

      {shownEditorial.length ? (
        <>
          <p className="h-more">
            <span className="label">
              {shownTaught.length
                ? 'Also listed here, with no programme in the catalogue yet'
                : 'Listed for this destination, with no programme in the catalogue yet'}
            </span>
          </p>
          <div className="h-grid">
            {shownEditorial.map((subject) => card(subject, countrySlug))}
          </div>
        </>
      ) : null}

      {found === 0 ? (
        <p className="dir__none">
          No subject in {emptyLabel} matches “{query.trim()}”.
        </p>
      ) : null}
    </>
  );
}

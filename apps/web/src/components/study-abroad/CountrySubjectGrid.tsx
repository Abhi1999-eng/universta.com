'use client';

import { useMemo } from 'react';
import { isSearching, matchesSubject } from '@/lib/subject-search';
import { useSubjectSearch } from './CountrySubjectSearch';
import { RowCard, countLabel } from './RowCard';

/**
 * Every field taught in one destination, narrowed by the search box in the
 * page's hero.
 *
 * Thirty subjects is past the number anybody scans. The filter runs in the
 * browser because the whole list is already here -- a destination has tens
 * of subjects, not thousands -- so typing costs no request and the result
 * is instant. What has been typed lives in `SubjectSearchProvider`, because
 * the box is above the tabs and these cards are below them.
 */

export type CountrySubjectCard = {
  id: string;
  name: string;
  slug: string;
  /** How many specializations the field holds; omitted when none. */
  specializations: number;
};

function card(subject: CountrySubjectCard, countrySlug: string) {
  return (
    <RowCard
      key={subject.id}
      href={`/study-abroad/${countrySlug}/${subject.slug}`}
      title={subject.name}
      meta={countLabel(subject.specializations, 'specialization')}
      mark
    />
  );
}

export function CountrySubjectGrid({
  taught,
  editorial,
  countrySlug,
  note = null,
}: {
  /** Fields a published course is actually taught in. */
  taught: CountrySubjectCard[];
  /** Fields an editor listed for a market the catalogue has not reached. */
  editorial: CountrySubjectCard[];
  countrySlug: string;
  /** Said once above the grid when none of these is recorded against the
   * destination -- the list is the catalogue's rather than its own. */
  note?: string | null;
}) {
  const { query } = useSubjectSearch();
  /* One box over both lists. The two are shown apart -- a derived field
     opens on something, an editorial one may not -- but a reader typing
     "engin" is asking the page a single question. */
  const shownTaught = useMemo(
    () => taught.filter((row) => matchesSubject(row.name, query)),
    [taught, query],
  );
  const shownEditorial = useMemo(
    () => editorial.filter((row) => matchesSubject(row.name, query)),
    [editorial, query],
  );
  const found = shownTaught.length + shownEditorial.length;

  return (
    <>
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

      {/* The reference site's words, and on the left where the cards
          were: a centred line in the middle of an empty section read as the
          page having failed rather than the search having found nothing.
          Only for a search: a destination with no subjects at all has its
          own sentence on the page, and nothing was searched for there. */}
      {found === 0 && isSearching(query) ? (
        <p className="subjnone" role="status">
          No subjects matched. Try a shorter word.
        </p>
      ) : null}
    </>
  );
}

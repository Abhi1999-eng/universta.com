'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { listHref, readListState } from '@/lib/university-list';

/**
 * The big search box over a university list.
 *
 * It searches the list on the page it sits on, whichever that is -- the
 * worldwide directory or one destination's list -- by writing the term into
 * that page's own address. It used to send every search to /universities,
 * so a reader searching inside Germany's list was dropped into every
 * country's.
 *
 * The term joins whatever filters are already set, and the reader starts
 * again from the first cards. It is a history entry of its own, so Back
 * undoes a search; ticking a filter is not, which is the behaviour
 * reference's split too.
 */
export function UniversitySearch({
  placeholder,
  label,
}: {
  placeholder: string;
  label: string;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  /* The field follows the address, so Back, a shared link and the list's
     own "Clear filters" all leave it showing the search actually applied. */
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  return (
    <form
      className="bigsearch"
      role="search"
      action={path}
      onSubmit={(event) => {
        event.preventDefault();
        const state = readListState(params);
        window.history.pushState(
          null,
          '',
          `${listHref(path, { ...state, q: query.trim(), page: 1 })}`,
        );
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#667085"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        className="bigsearch__input"
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        maxLength={100}
      />
      <button className="btn btn--sm" type="submit">
        Search{' '}
        <span className="btn__arrow" aria-hidden="true">
          &rarr;
        </span>
      </button>
    </form>
  );
}

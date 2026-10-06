'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * The big search box over one destination's scholarships or consultants.
 *
 * It searches the list on its own page by writing `q` into the page's
 * address beside whatever filters are already set, and the reader starts
 * again from the first cards. A search is a history entry of its own, so
 * Back undoes it; ticking a filter is not. The universities list's box does
 * the same, but keeps only that list's parameters, so this one keeps
 * whatever the address holds and changes only the search and the page.
 */
export function CountryListSearch({
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
     own "Clear all" all leave it showing the search actually applied. */
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
        const next = new URLSearchParams(params.toString());
        const term = query.trim();
        if (term) next.set('q', term);
        else next.delete('q');
        next.delete('page');
        const search = next.toString();
        window.history.pushState(null, '', search ? `${path}?${search}` : path);
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

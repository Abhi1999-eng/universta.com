'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Specialisation search for the approved specialisations hero.
 *
 * The term goes into the URL so the filtered list is shareable and survives a
 * reload, and the results region takes focus on submit — otherwise a keyboard
 * visitor is left at the top of the page with no signal that anything below
 * changed. */

export function SpecializationSearch({ query, subject }: { query: string; subject: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  /** Re-seed when the page itself moves (submit, clear, back, forward). */
  const [seen, setSeen] = useState(query);
  if (seen !== query) {
    setSeen(query);
    setValue(query);
  }

  /** Set when a search is submitted, so the results region is focused again
   * once the server has re-rendered it under the new term. */
  const owedFocus = useRef(false);
  useEffect(() => {
    if (!owedFocus.current) return;
    owedFocus.current = false;
    document.getElementById('all')?.focus();
  }, [query]);

  function commit(term: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (term) params.set('q', term);
    else params.delete('q');
    // A new search starts at the first page of results, not wherever the
    // previous one had been paged to.
    params.delete('page');
    owedFocus.current = true;
    document.getElementById('all')?.focus();
    router.push(`${pathname}${params.size ? `?${params}` : ''}`);
  }

  return (
    <form
      className="searchwrap"
      onSubmit={(event) => {
        event.preventDefault();
        commit(value.trim());
      }}
    >
      <div className="bigsearch searchbar">
        {/* The reference draws its magnifier rather than setting an emoji,
            which renders as a different glyph on every platform. */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#667085"
          strokeWidth="1.7"
          aria-hidden="true"
          className="ic"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="bigsearch__input"
          type="text"
          aria-label="Search specializations"
          placeholder={`Search ${subject} specialisations…`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {/* The arrow is decoration, so the button is still named
            "Find specializations" to anything reading the page. */}
        <button type="submit" className="btn btn--sm">
          Find specializations{' '}
          <span className="btn__arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
      {query ? (
        <p className="bigsearch__ex">
          <button
            type="button"
            className="linkbtn"
            onClick={() => {
              setValue('');
              commit('');
            }}
          >
            Clear search
          </button>
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

/**
 * The directory hero's search, as the design draws it: a Destination
 * select beside the box, and "Find consultants".
 *
 * It narrows the list on the same page, writing `country` and `q` into
 * the address beside whatever filters are already set, as the list's own
 * Destination filter and the box always have. A search is a history entry
 * of its own, so Back undoes it. Without script the form still works: it
 * asks for the same address.
 *
 * The select shows the destination the address holds when it holds one.
 * When the list's filters hold several, it shows "Any destination" and a
 * search leaves them as they are unless the select is changed.
 */
export function ConsultantSearch({
  destinations,
  placeholder,
}: {
  /** Published destinations, in the order to offer them. */
  destinations: ReadonlyArray<{ slug: string; name: string }>;
  placeholder: string;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const chosen = (params.get('country') ?? '')
    .split(',')
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  const urlDestination = chosen.length === 1 && destinations.some((entry) => entry.slug === chosen[0]) ? chosen[0]! : '';
  const [query, setQuery] = useState(urlQuery);
  const [destination, setDestination] = useState(urlDestination);

  /* Both follow the address, so Back, a shared link, a chip removed or the
     list's own "Clear all" leave them showing what is applied. */
  const [seen, setSeen] = useState({ query: urlQuery, destination: urlDestination });
  if (seen.query !== urlQuery || seen.destination !== urlDestination) {
    setSeen({ query: urlQuery, destination: urlDestination });
    setQuery(urlQuery);
    setDestination(urlDestination);
  }

  return (
    <form
      className="coachsearch"
      role="search"
      action={path}
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        const term = query.trim();
        if (term) next.set('q', term);
        else next.delete('q');
        if (destination !== urlDestination) {
          if (destination) next.set('country', destination);
          else next.delete('country');
        }
        next.delete('page');
        const search = next.toString();
        window.history.pushState(null, '', search ? `${path}?${search}` : path);
      }}
    >
      <label className="coachsearch__field">
        <span className="label">Destination</span>
        <select name="country" value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="">Any destination</option>
          {destinations.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="coachsearch__field coachsearch__field--grow">
        <span className="label">Search consultants</span>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={100}
        />
      </label>
      <button className="btn" type="submit">
        Find consultants{' '}
        <span className="btn__arrow" aria-hidden="true">
          &rarr;
        </span>
      </button>
    </form>
  );
}

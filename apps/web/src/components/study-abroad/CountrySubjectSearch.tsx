'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { matchesSubject } from '@/lib/subject-search';

/**
 * The search on a destination's subjects page.
 *
 * It sits in the hero, above the tabs, and the cards it narrows sit below
 * them -- so the two share what has been typed through this provider rather
 * than through one component that would have to own everything in between.
 *
 * How it behaves follows the reference site: it narrows as you type and
 * makes no request; Enter opens the subject when exactly one is left;
 * Escape empties the box; and `?q=` in the address starts the page already
 * searched, which is also what makes the box work before any script runs --
 * it is a real form that submits to this page.
 */
const SubjectSearchContext = createContext<{
  query: string;
  setQuery: (value: string) => void;
}>({ query: '', setQuery: () => undefined });

export function useSubjectSearch() {
  return useContext(SubjectSearchContext);
}

export function SubjectSearchProvider({
  initialQuery = '',
  children,
}: {
  /** What `?q=` held when the page was asked for. */
  initialQuery?: string;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return (
    <SubjectSearchContext.Provider value={value}>
      {children}
    </SubjectSearchContext.Provider>
  );
}

/**
 * The count under the section heading, which follows the search.
 *
 * The box is in the hero and the cards start a screen lower, so on a laptop
 * a reader typing saw nothing move. This line is between the two and is in
 * view while they type: "30 subjects" becomes "6 of 30 subjects".
 */
export function SubjectCount({ names }: { names: string[] }) {
  const { query } = useSubjectSearch();
  const total = names.length;
  const noun = total === 1 ? 'subject' : 'subjects';
  if (query.trim() === '') return <>{`${total} ${noun}`}</>;
  const left = names.filter((name) => matchesSubject(name, query)).length;
  return <>{`${left} of ${total} ${noun}`}</>;
}

export function SubjectSearchBox({
  countrySlug,
  subjects,
}: {
  countrySlug: string;
  /** Every subject on the page, so the box knows what is left. */
  subjects: Array<{ name: string; slug: string }>;
}) {
  const router = useRouter();
  const { query, setQuery } = useSubjectSearch();
  const left = useMemo(
    () => subjects.filter((subject) => matchesSubject(subject.name, query)),
    [subjects, query],
  );
  const searching = query.trim() !== '';

  return (
    <form
      className="bigsearch"
      role="search"
      method="get"
      action={`/study-abroad/${countrySlug}/subjects`}
      onSubmit={(event) => {
        /* The list is already narrowed; a reload would show the same cards
           after a wait. With one subject left, Enter means "that one". */
        event.preventDefault();
        if (searching && left.length === 1)
          router.push(`/study-abroad/${countrySlug}/${left[0].slug}`);
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label className="sr-only" htmlFor="subject-search">
        Search subjects
      </label>
      <input
        id="subject-search"
        className="bigsearch__input"
        type="search"
        name="q"
        value={query}
        maxLength={100}
        placeholder="Search subjects…"
        autoComplete="off"
        aria-describedby="subject-search-status"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && query) {
            event.preventDefault();
            setQuery('');
          }
        }}
      />
      <button className="btn btn--sm" type="submit">
        Search
      </button>
      {/* Said to a screen reader as the list changes; the cards themselves
          are the answer for everybody else. */}
      <p id="subject-search-status" className="sr-only" aria-live="polite">
        {searching
          ? `${left.length} ${left.length === 1 ? 'match' : 'matches'}`
          : ''}
      </p>
    </form>
  );
}

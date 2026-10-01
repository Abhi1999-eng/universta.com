'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FlagMark } from './FlagMark';

export type DirectoryDestination = {
  slug: string;
  name: string;
  iso2Code: string | null;
  count: number;
};

/**
 * The directory's opening band: what this page is, a search that commits to
 * the URL, and the destinations that actually hold institutions.
 *
 * The approved build offers example searches from a list an editor keeps.
 * There is no such list here, so the row beneath the box is the destinations
 * the catalogue has, with their counts -- the same job, built from data
 * rather than from a copy deck nobody has written yet.
 */
export function UniversityIndexHero({
  total,
  destinations,
}: {
  total: number;
  destinations: DirectoryDestination[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);

  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const commit = (term: string) => {
    const next = new URLSearchParams(params.toString());
    if (term.trim()) next.set('q', term.trim());
    else next.delete('q');
    const search = next.toString();
    router.push(search ? `/universities?${search}` : '/universities');
  };

  return (
    <section className="hero hero--compact">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="crumbs__sep" aria-hidden="true">
            /
          </span>
          <span aria-current="page">Universities</span>
        </nav>

        <div className="hero__lead">
          <p className="hero__eyebrow">
            University discovery<b>·</b>
            {total} published
          </p>
          <h1 className="hero__h1">Find the universities worth applying to</h1>
          <p className="hero__sub">
            Every institution here is a published record in the Universta
            catalogue. There is no paid placement and no ranking of our own:
            narrow by destination and type, then open one to see the
            programmes it actually offers.
          </p>
        </div>

        <form
          className="bigsearch"
          onSubmit={(event) => {
            event.preventDefault();
            commit(query);
          }}
        >
          <input
            className="bigsearch__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search universities or destinations"
            aria-label="Search universities or destinations"
            autoComplete="off"
          />
          <button className="btn btn--sm" type="submit">
            Search{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </button>
        </form>

        {destinations.length ? (
          <div className="destrow">
            <span className="label">Destinations with institutions</span>
            <div className="destrow__items">
              {destinations.map((entry) => (
                <Link
                  className="destchip"
                  key={entry.slug}
                  href={`/study-abroad/${entry.slug}`}
                >
                  <FlagMark iso2Code={entry.iso2Code} bands={null} />
                  <span>{entry.name}</span>
                  <em>{entry.count}</em>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FlagMark } from './FlagMark';

export type UniversityIndexRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  institutionType: string | null;
  qsRanking: number | null;
  programmes: number;
  campuses: number;
  country: { name: string; slug: string; iso2Code: string | null } | null;
};

/**
 * The university directory, in the approved build's own markup.
 *
 * That build filters and sorts in the browser over the whole catalogue and
 * has no pager at all, which is why this one loads every published
 * institution and does the same: the counts beside each filter are then
 * true, and narrowing never costs a round trip.
 *
 * Two things the reference card carries are left out rather than shipped
 * inert. Its "profile fit" badge is scored against a student profile this
 * product does not collect yet, and its tuition and language figures are
 * recorded per course offering here, not per institution -- a number in
 * that slot would have to be invented. What a card shows is what the
 * catalogue actually holds about an institution.
 */
const SORTS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'programs', label: 'Most programmes' },
  { value: 'ranking', label: 'Ranked first' },
] as const;

type Sort = (typeof SORTS)[number]['value'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

const typeLabel = (value: string | null) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .map((word) => word[0]!.toUpperCase() + word.slice(1))
        .join(' ')
    : null;

export function UniversityIndex({
  universities,
}: {
  universities: UniversityIndexRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [countries, setCountries] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('name');
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* The field follows the URL, so a shared link, a refresh and the back
     button all land on the same filtered page rather than an empty one. */
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

  /* Built from the catalogue, so a filter can never offer a value that
     would empty the grid. */
  const countryOptions = useMemo(() => {
    const seen = new Map<
      string,
      { slug: string; name: string; iso2Code: string | null; count: number }
    >();
    for (const row of universities) {
      if (!row.country) continue;
      const entry = seen.get(row.country.slug) ?? {
        ...row.country,
        count: 0,
      };
      entry.count += 1;
      seen.set(row.country.slug, entry);
    }
    return [...seen.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [universities]);

  const typeOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const row of universities)
      if (row.institutionType)
        seen.set(row.institutionType, (seen.get(row.institutionType) ?? 0) + 1);
    return [...seen.entries()]
      .map(([value, count]) => ({ value, label: typeLabel(value)!, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [universities]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = universities.filter((row) => {
      if (countries.length && !countries.includes(row.country?.slug ?? '')) return false;
      if (types.length && !types.includes(row.institutionType ?? '')) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        (row.country?.name ?? '').toLowerCase().includes(term) ||
        (row.shortDescription ?? '').toLowerCase().includes(term)
      );
    });
    const sorted = [...rows];
    if (sort === 'programs') sorted.sort((a, b) => b.programmes - a.programmes || a.name.localeCompare(b.name));
    else if (sort === 'ranking')
      /* Unranked institutions are not worst, they are unmeasured, so they
         follow the ranked ones in their own order rather than being given
         a position they do not have. */
      sorted.sort((a, b) => {
        if (a.qsRanking && b.qsRanking) return a.qsRanking - b.qsRanking;
        if (a.qsRanking) return -1;
        if (b.qsRanking) return 1;
        return a.name.localeCompare(b.name);
      });
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [universities, query, countries, types, sort]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const active = countries.length + types.length;

  return (
    <section
      className="sec sec--white sec--tight"
      id="results"
      aria-labelledby="results-heading"
    >
      <div className="wrap">
        {/* The band carries no visible title -- the approved design opens
            straight into the filters and the grid -- but the outline needs
            one between the page's h1 and the cards' h3 names, and a screen
            reader needs the region named. */}
        <h2 className="sr-only" id="results-heading">
          All universities
        </h2>
        <div className="results">
          <aside
            className="filters-panel filters-panel--live"
            id="uni-filters"
            data-open={String(filtersOpen)}
            aria-label="University filters"
          >
            <div className="filters-panel__head">
              <span className="filters-panel__title">Filters</span>
              {active ? (
                <button
                  className="linkbtn"
                  type="button"
                  onClick={() => {
                    setCountries([]);
                    setTypes([]);
                  }}
                >
                  Clear all
                </button>
              ) : null}
              <button
                className="cs__close filters-panel__close"
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                &times;
              </button>
            </div>

            <div className="filters-panel__body">
              {countryOptions.length ? (
                <div className="fgroup">
                  <p className="fgroup__t">Destination</p>
                  <div className="fgroup__opts">
                    {countryOptions.map((option) => (
                      <label className="fcheck" key={option.slug}>
                        <input
                          type="checkbox"
                          checked={countries.includes(option.slug)}
                          onChange={() => setCountries(toggle(countries, option.slug))}
                        />
                        <span>{option.name}</span>
                        <em>{option.count}</em>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {typeOptions.length > 1 ? (
                <div className="fgroup">
                  <p className="fgroup__t">Institution type</p>
                  <div className="fgroup__opts">
                    {typeOptions.map((option) => (
                      <label className="fcheck" key={option.value}>
                        <input
                          type="checkbox"
                          checked={types.includes(option.value)}
                          onChange={() => setTypes(toggle(types, option.value))}
                        />
                        <span>{option.label}</span>
                        <em>{option.count}</em>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="filters-panel__foot">
              <button
                className="btn btn--sm btn--block"
                type="button"
                onClick={() => setFiltersOpen(false)}
              >
                Show {shown.length} {shown.length === 1 ? 'university' : 'universities'}
              </button>
            </div>
          </aside>

          <div className="results__main">
            <div className="results__bar">
              <span className="results__count">
                {shown.length} {shown.length === 1 ? 'university' : 'universities'}
              </span>
              <div className="results__tools">
                <button
                  className="chipbtn filters-toggle"
                  type="button"
                  aria-controls="uni-filters"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(true)}
                >
                  Filters {active ? <em>{active}</em> : null}
                </button>
                <label className="sortsel">
                  <span className="sr-only">Sort universities</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                    {SORTS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {shown.length ? (
              <div className="unigrid">
                {shown.map((row) => (
                  <article className="unicard" key={row.id}>
                    <div className="unicard__head">
                      <span className="unimark" aria-hidden="true">
                        {initials(row.name)}
                      </span>
                      <div className="unicard__id">
                        <h3 className="unicard__name">
                          <Link href={`/universities/${row.slug}`}>{row.name}</Link>
                        </h3>
                        {row.country ? (
                          <p className="unicard__where">
                            <FlagMark iso2Code={row.country.iso2Code} bands={null} />
                            {row.country.name}
                          </p>
                        ) : null}
                        {typeLabel(row.institutionType) ? (
                          <p className="unicard__type">{typeLabel(row.institutionType)}</p>
                        ) : null}
                      </div>
                    </div>

                    <dl className="unicard__stats">
                      <div>
                        <dt>Programmes</dt>
                        <dd>{row.programmes}</dd>
                      </div>
                      <div>
                        <dt>Campuses</dt>
                        <dd>{row.campuses || 1}</dd>
                      </div>
                    </dl>

                    {row.shortDescription ? (
                      <p className="unicard__fields">{row.shortDescription}</p>
                    ) : null}

                    <div className="unicard__foot">
                      <Link className="btn btn--sm" href={`/universities/${row.slug}`}>
                        View university{' '}
                        <span className="btn__arrow" aria-hidden="true">
                          &rarr;
                        </span>
                      </Link>
                      {row.country ? (
                        <Link className="btn btn--sm btn--ghost" href={`/study-abroad/${row.country.slug}`}>
                          {row.country.name} guide
                        </Link>
                      ) : null}
                      {row.qsRanking ? (
                        <span className="unicard__rank">
                          Ranked #{row.qsRanking} · one factor among many
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dir__none">
                No university matches that. Clear a filter, or search for a
                destination instead.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export { SORTS as UNIVERSITY_SORTS, initials as universityInitials };

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { UniversityCard } from './UniversityCard';
import {
  PAGE_STEP,
  UNIVERSITY_SORTS,
  activeFilterCount,
  effectiveFilters,
  filterUniversities,
  listHref,
  listOptions,
  narrows,
  readListState,
  type FilterOption,
  type UniversityListRow,
  type UniversityListState,
  type UniversitySort,
} from '@/lib/university-list';

export type UniversityIndexRow = UniversityListRow;

/**
 * A list of universities: the filters, the results bar and the cards, in
 * the approved build's markup, behaving the way the behaviour reference's
 * lists do.
 *
 * One block for both lists -- the worldwide directory and a destination's
 * own -- so the two cannot drift apart. On a destination's list the
 * destination is already chosen, so it is not offered again and the city
 * group is there from the start.
 *
 * It narrows in the browser over the rows the page read, so every count
 * beside a filter is true and no tick costs a round trip. Every choice is
 * written into the address as it is made: a shared link, a refresh and the
 * back button from a university all come back to the same list, scrolled
 * as far as the reader had loaded it.
 *
 * Eighteen cards first, then "Load more" adds eighteen at a time -- the
 * reference's step. The whole catalogue on one page made the directory
 * 49,000 pixels tall and put a quarter of a megabyte of cards in front of a
 * reader who wanted one.
 */
export function UniversityIndex({
  universities,
  country = null,
  footer = null,
}: {
  universities: UniversityIndexRow[];
  /** Set on a destination's own list. `name` is the name as it reads in a
   * sentence: "the United Kingdom". */
  country?: { slug: string; name: string } | null;
  /** Under the notes, inside the results column. */
  footer?: React.ReactNode;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const state = readListState(params);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState('');

  /* Worked out afresh from the address on every render. It runs when the
     reader does something, over a list the page already holds, and a
     cached copy is one more thing that could disagree with the address. */
  const options = listOptions(universities, country ? [] : state.countries);
  const filters = effectiveFilters(
    country ? { ...state, countries: [] } : state,
    options,
  );
  const shown = filterUniversities(universities, filters, state.q, state.sort);

  const active = activeFilterCount(filters);
  const narrowed = active > 0 || state.q !== '';
  const visible = Math.min(shown.length, state.page * PAGE_STEP);
  const scope = options.scope.length;

  /* A group is offered when it would change the list -- and always while
     one of its boxes is ticked, so a choice that stopped narrowing anything
     can still be unticked where it was made. The city list means something
     only inside a destination: offered on a destination's own list, and on
     the directory once one is ticked. */
  const groups = {
    destinations: !country && options.destinations.length > 0,
    cities:
      (country !== null || filters.countries.length > 0) &&
      (narrows(options.cities, scope) || filters.cities.length > 0),
    subjects: narrows(options.subjects, scope) || filters.subjects.length > 0,
    types: narrows(options.types, scope) || filters.types.length > 0,
    ranked: (options.ranked > 0 && options.ranked < scope) || filters.ranked,
  };
  /* Nothing to narrow by -- no destination holds an institution and no
     group would change the list. The panel and its toggle both hang off
     this. */
  const hasFilters = Object.values(groups).some(Boolean);

  /** Write a new state into the address without a server round trip. A
   * changed filter, search or order starts again from the first cards. */
  const commit = (next: Partial<UniversityListState>, keepPage = false) => {
    const merged: UniversityListState = {
      ...state,
      ...filters,
      ...next,
      ...(keepPage ? {} : { page: 1 }),
    };
    if (country) merged.countries = [];
    /* Settled against the options the new choice leaves, so unticking a
       destination also lets go of its cities rather than keeping them in
       the address with nothing to match. */
    const settled = {
      ...merged,
      ...effectiveFilters(merged, listOptions(universities, merged.countries)),
    };
    window.history.replaceState(null, '', listHref(path, settled));
    if (!keepPage) setStatus('');
  };

  const toggle = (key: 'countries' | 'types' | 'cities' | 'subjects', value: string) => {
    const list = filters[key];
    commit({
      [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
    });
  };

  const clear = () => {
    window.history.replaceState(null, '', path);
    setStatus('');
  };

  const loadMore = () => {
    const added = Math.min(PAGE_STEP, shown.length - visible);
    commit({ page: state.page + 1 }, true);
    setStatus(`${added} more ${added === 1 ? 'university' : 'universities'} loaded`);
  };

  const noun = (count: number) => (count === 1 ? 'university' : 'universities');
  const anyRanked = shown.some((row) => row.qsRanking);

  const group = (
    title: string,
    key: 'countries' | 'types' | 'cities' | 'subjects',
    list: FilterOption[],
    scroll = false,
  ) => (
    <div className="fgroup">
      <p className="fgroup__t">{title}</p>
      <div className={scroll ? 'fgroup__opts fgroup__opts--scroll' : 'fgroup__opts'}>
        {list.map((option) => (
          <label className="fcheck" key={option.value}>
            <input
              type="checkbox"
              checked={filters[key].includes(option.value)}
              onChange={() => toggle(key, option.value)}
            />
            <span>{option.label}</span>
            <em>{option.count}</em>
          </label>
        ))}
      </div>
    </div>
  );

  const clearLink = (label: string, className: string) => (
    <Link
      className={className}
      href={path}
      scroll={false}
      onClick={(event) => {
        event.preventDefault();
        clear();
      }}
    >
      {label}
    </Link>
  );

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
          {country ? `Universities in ${country.name}` : 'All universities'}
        </h2>
        <div className={hasFilters ? 'results' : 'results results--open'}>
          {/* Every group is built from the rows, so a list with nothing to
              narrow by offers nothing, and the panel stands down with its
              groups rather than framing the absence of them. */}
          {hasFilters ? (
            <aside
              className="filters-panel filters-panel--live"
              id="uni-filters"
              data-open={String(filtersOpen)}
              aria-label="University filters"
            >
              <div className="filters-panel__head">
                <span className="filters-panel__title">Filters</span>
                {narrowed ? clearLink('Clear all', 'linkbtn') : null}
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
                {groups.destinations
                  ? group('Destination', 'countries', options.destinations, options.destinations.length > 8)
                  : null}
                {groups.cities ? group('City', 'cities', options.cities, options.cities.length > 8) : null}
                {groups.subjects
                  ? group('Field of study', 'subjects', options.subjects, options.subjects.length > 8)
                  : null}
                {groups.types ? group('Institution type', 'types', options.types) : null}
                {groups.ranked ? (
                  <div className="fgroup">
                    <p className="fgroup__t">Ranking</p>
                    <div className="fgroup__opts">
                      <label className="fcheck">
                        <input
                          type="checkbox"
                          checked={filters.ranked}
                          onChange={() => commit({ ranked: !filters.ranked })}
                        />
                        <span>Ranked by QS</span>
                        <em>{options.ranked}</em>
                      </label>
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
                  Show {shown.length} {noun(shown.length)}
                </button>
              </div>
            </aside>
          ) : null}

          <div className="results__main">
            <div className="results__bar">
              <span className="results__count" aria-live="polite">
                {shown.length} {noun(shown.length)}
              </span>
              <div className="results__tools">
                {hasFilters ? (
                  <button
                    className="chipbtn filters-toggle"
                    type="button"
                    aria-controls="uni-filters"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen(true)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18M7 12h10M11 18h2" />
                    </svg>
                    Filters {active ? <em>{active}</em> : null}
                  </button>
                ) : null}
                <label className="sortsel">
                  <span className="sr-only">Sort universities</span>
                  <select
                    value={state.sort}
                    onChange={(event) =>
                      commit({ sort: event.target.value as UniversitySort })
                    }
                  >
                    {UNIVERSITY_SORTS.map((option) => (
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
                {shown.slice(0, visible).map((row) => (
                  <UniversityCard key={row.id} university={row} guide={!country} />
                ))}
              </div>
            ) : (
              <div className="dir__none">
                {/* Telling a reader to clear a filter they have not set, or
                    to search a catalogue that holds nothing, is advice they
                    cannot take. Each case says only what is true of it. */}
                <p>
                  {universities.length === 0
                    ? country
                      ? `No university in ${country.name} is published yet.`
                      : 'No university is published yet. Destinations and subjects are worth a look in the meantime.'
                    : narrowed
                      ? 'No university matches that. Try a shorter name, or clear the filters.'
                      : 'No university matches that.'}
                </p>
                {narrowed ? clearLink('Clear filters', 'btn btn--sm btn--ghost') : null}
              </div>
            )}

            {shown.length > PAGE_STEP ? (
              <div className="unimore">
                <span className="results__count">
                  Showing {visible} of {shown.length}
                </span>
                {visible < shown.length ? (
                  <>
                    <button className="btn btn--ghost" type="button" onClick={loadMore}>
                      Load more universities
                    </button>
                    {/* Without script the button cannot add anything, so a
                        link to the next step stands in for it. */}
                    <noscript>
                      <a
                        className="btn btn--ghost"
                        rel="nofollow"
                        href={`${listHref(path, { ...state, page: state.page + 1 })}#results`}
                      >
                        Show more universities
                      </a>
                    </noscript>
                  </>
                ) : (
                  <span className="unimore__end">You’ve reached the end of the list.</span>
                )}
                <p className="unimore__status" role="status" aria-live="polite">
                  {status}
                </p>
              </div>
            ) : null}

            {state.sort === 'ranking' && shown.length ? (
              <p className="trust__note">
                {anyRanked
                  ? 'Universities with a published QS ranking come first, in that order, and the rest follow A to Z. This is display order only, not a Universta ranking.'
                  : 'None of these universities has a published QS ranking on its profile, so they are listed A to Z.'}
              </p>
            ) : null}
            <p className="trust__note">
              Only universities with a published Universta profile are listed.
              A rank shown on a card is the QS World University Rankings
              position, one factor among many; Universta does not rank
              universities itself.
            </p>
            {footer ? <div className="unilist__foot">{footer}</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

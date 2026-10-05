'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FUNDING_CAVEAT, ScholarshipCards } from './ScholarshipCards';
import {
  SCHOLARSHIP_SORTS,
  SCHOLARSHIP_STEP,
  activeScholarshipFilters,
  filterScholarships,
  narrowsScholarships,
  readScholarshipState,
  scholarshipListHref,
  scholarshipOptions,
  type CountryScholarshipRow,
  type ScholarshipFilterOption,
  type ScholarshipListState,
  type ScholarshipSort,
} from '@/lib/country-scholarship-list';

/**
 * One destination's scholarships: the filters, the results bar, the cards
 * and "Load more", in the approved build's results markup.
 *
 * The same block as the destination's universities list, narrowing in the
 * browser over every award the page read and writing each choice into the
 * address as it is made, so a shared link, a refresh and the back button
 * from an award all come back to the same list, as far as it was loaded.
 */
export function CountryScholarshipIndex({
  rows,
  levels,
  where,
}: {
  rows: CountryScholarshipRow[];
  /** The catalogue's study levels, in academic order, for their names. */
  levels: ReadonlyArray<{ code: string; name: string }>;
  /** The destination as it reads in a sentence: "the United Kingdom". */
  where: string;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const state = readScholarshipState(params);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState('');

  const options = scholarshipOptions(rows, levels);
  /* A value the address carries that no award here has -- a level typed by
     hand, a funding type from another destination's link -- is set aside
     rather than allowed to empty the list. */
  const filters: ScholarshipListState = {
    ...state,
    levels: state.levels.filter((code) => options.levels.some((option) => option.value === code)),
    types: state.types.filter((type) => options.types.some((option) => option.value === type)),
  };
  const shown = filterScholarships(rows, filters);
  const active = activeScholarshipFilters(filters);
  const narrowed = active > 0 || filters.q !== '';
  const visible = Math.min(shown.length, filters.page * SCHOLARSHIP_STEP);
  const total = rows.length;

  const groups = {
    levels: narrowsScholarships(options.levels, total) || filters.levels.length > 0,
    types: narrowsScholarships(options.types, total) || filters.types.length > 0,
    open: (options.open > 0 && options.open < total) || filters.open,
  };
  const hasFilters = Object.values(groups).some(Boolean);

  const commit = (next: Partial<ScholarshipListState>, keepPage = false) => {
    const merged: ScholarshipListState = {
      ...filters,
      ...next,
      ...(keepPage ? {} : { page: 1 }),
    };
    window.history.replaceState(null, '', scholarshipListHref(path, merged));
    if (!keepPage) setStatus('');
  };

  const toggle = (key: 'levels' | 'types', value: string) => {
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
    const added = Math.min(SCHOLARSHIP_STEP, shown.length - visible);
    commit({ page: filters.page + 1 }, true);
    setStatus(`${added} more ${added === 1 ? 'scholarship' : 'scholarships'} loaded`);
  };

  const noun = (count: number) => (count === 1 ? 'scholarship' : 'scholarships');

  const group = (
    title: string,
    key: 'levels' | 'types',
    list: ScholarshipFilterOption[],
  ) => (
    <div className="fgroup">
      <p className="fgroup__t">{title}</p>
      <div className={list.length > 8 ? 'fgroup__opts fgroup__opts--scroll' : 'fgroup__opts'}>
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
    <section className="sec sec--white sec--tight" id="scholarships" aria-labelledby="results-heading">
      <div className="wrap">
        <h2 className="sr-only" id="results-heading">
          Scholarships to study in {where}
        </h2>
        <div className={hasFilters ? 'results' : 'results results--open'}>
          {hasFilters ? (
            <aside
              className="filters-panel filters-panel--live"
              id="sch-filters"
              data-open={String(filtersOpen)}
              aria-label="Scholarship filters"
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
                {groups.levels ? group('Study level', 'levels', options.levels) : null}
                {groups.types ? group('Funding type', 'types', options.types) : null}
                {groups.open ? (
                  <div className="fgroup">
                    <p className="fgroup__t">Deadline</p>
                    <div className="fgroup__opts">
                      <label className="fcheck">
                        <input
                          type="checkbox"
                          checked={filters.open}
                          onChange={() => commit({ open: !filters.open })}
                        />
                        <span>Not past its deadline</span>
                        <em>{options.open}</em>
                      </label>
                    </div>
                    <p className="fgroup__note">
                      Includes awards with no closing date recorded.
                    </p>
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
                    aria-controls="sch-filters"
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
                {total > 1 ? (
                  <label className="sortsel">
                    <span className="sr-only">Sort scholarships</span>
                    <select
                      value={filters.sort}
                      onChange={(event) =>
                        commit({ sort: event.target.value as ScholarshipSort })
                      }
                    >
                      {SCHOLARSHIP_SORTS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>

            {shown.length ? (
              <ScholarshipCards scholarships={shown.slice(0, visible)} columns={2} />
            ) : (
              <div className="dir__none">
                <p>
                  {total === 0
                    ? `No scholarship for ${where} is published yet.`
                    : narrowed
                      ? 'No scholarship matches that. Try a shorter word, or clear the filters.'
                      : 'No scholarship matches that.'}
                </p>
                {narrowed ? clearLink('Clear filters', 'btn btn--sm btn--ghost') : null}
              </div>
            )}

            {shown.length > SCHOLARSHIP_STEP ? (
              <div className="unimore">
                <span className="results__count">
                  Showing {visible} of {shown.length}
                </span>
                {visible < shown.length ? (
                  <>
                    <button className="btn btn--ghost" type="button" onClick={loadMore}>
                      Load more scholarships
                    </button>
                    <noscript>
                      <a
                        className="btn btn--ghost"
                        rel="nofollow"
                        href={`${scholarshipListHref(path, { ...filters, page: filters.page + 1 })}#scholarships`}
                      >
                        Show more scholarships
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

            <p className="trust__note">{FUNDING_CAVEAT}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

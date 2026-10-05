'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { counsellingHref } from '@/lib/counselling-link';
import {
  CONSULTANT_SORTS,
  CONSULTANT_STEP,
  activeConsultantFilters,
  consultantListHref,
  consultantOptions,
  countryConsultantsHref,
  filterConsultants,
  narrowsConsultants,
  readConsultantState,
  type ConsultantFilterOption,
  type ConsultantListState,
  type ConsultantSort,
  type CountryConsultantRow,
} from '@/lib/country-consultant-list';

/** How many services a card names before "+N more". */
const SERVICES_SHOWN = 4;
/** How many destinations a card names before "+N more". */
const DESTINATIONS_SHOWN = 5;

/**
 * A consultant as the approved build's card draws one: verification first,
 * then the name, the destinations it lists, where it sees students and what
 * it helps with. No phone or email on the card -- the build keeps contact
 * behind the profile -- and only facts the record holds: a card never says
 * "experience" or "rating" for a consultant nobody has recorded one for.
 */
export function ConsultantCard({
  consultant,
  countrySlug,
  guides = [],
}: {
  consultant: CountryConsultantRow;
  /** The destination the page is about, named first among the badges. */
  countrySlug: string;
  /** The destinations with a published guide, whose consultants pages
   *  exist: a badge for any other is a name, not a link to a missing page. */
  guides?: readonly string[];
}) {
  const href = `/study-abroad-consultants/${consultant.slug}`;
  const destinations = [
    ...consultant.destinations.filter((entry) => entry.slug === countrySlug),
    ...consultant.destinations.filter((entry) => entry.slug !== countrySlug),
  ];
  const moreDestinations = destinations.length - DESTINATIONS_SHOWN;
  const moreServices = consultant.services.length - SERVICES_SHOWN;
  return (
    <article className="consultcard" data-consultant={consultant.slug}>
      <div className="consultcard__top">
        <div className="instcard__badges">
          <span className={`badge ${consultant.verified ? 'badge--ok' : 'badge--neutral'}`}>
            {consultant.verified ? '✓ Verified' : 'Not yet verified'}
          </span>
        </div>
      </div>

      <h3 className="consultcard__name">
        <Link href={href}>{consultant.name}</Link>
      </h3>

      {destinations.length ? (
        <div className="destbadges" aria-label="Destinations">
          {/* Each destination with a guide opens its own consultants, the
              way across the directory the reference's cards give too. */}
          {destinations.slice(0, DESTINATIONS_SHOWN).map((entry) =>
            entry.slug === countrySlug ? (
              <span className="destbadge destbadge--here" key={entry.slug}>
                {entry.name}
              </span>
            ) : guides.includes(entry.slug) ? (
              <Link className="destbadge" href={countryConsultantsHref(entry.slug)} key={entry.slug}>
                {entry.name}
              </Link>
            ) : (
              <span className="destbadge" key={entry.slug}>
                {entry.name}
              </span>
            ),
          )}
          {moreDestinations > 0 ? (
            <span className="destbadge destbadge--more">+{moreDestinations} more</span>
          ) : null}
        </div>
      ) : null}

      {consultant.cities.length ? (
        <p className="instcard__loc">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          <span className="sr-only">Sees students in </span>
          {consultant.cities.join(', ')}
        </p>
      ) : null}

      {consultant.services.length ? (
        <div className="consultcard__block">
          <span className="label">Services</span>
          <div className="tagrow">
            {consultant.services.slice(0, SERVICES_SHOWN).map((service) => (
              <span className="tag" key={service.slug}>
                {service.name}
              </span>
            ))}
            {moreServices > 0 ? <span className="tag tag--more">+{moreServices} more</span> : null}
          </div>
        </div>
      ) : null}

      {consultant.languages.length || consultant.cities.length ? (
        <dl className="instcard__facts consultcard__facts">
          {consultant.languages.length ? (
            <div>
              <dt>Languages</dt>
              <dd>{consultant.languages.map((language) => language.name).join(', ')}</dd>
            </div>
          ) : null}
          {consultant.cities.length ? (
            <div>
              <dt>{consultant.cities.length === 1 ? 'Office' : 'Offices'}</dt>
              <dd>
                {consultant.cities.length}{' '}
                {consultant.cities.length === 1 ? 'city' : 'cities'}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="instcard__foot">
        <Link className="btn btn--sm btn--ghost" href={href}>
          View consultant{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
        <Link
          className="btn btn--sm"
          href={counsellingHref({
            source: 'country',
            country: countrySlug,
            from: countryConsultantsHref(countrySlug),
          })}
        >
          Get guidance{' '}
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>
    </article>
  );
}

/**
 * One destination's consultants: the filters, the results bar, the cards
 * and "Load more", in the approved build's results markup, behaving the way
 * the destination's universities list does -- narrowed in the browser, each
 * choice written into the address as it is made.
 */
export function CountryConsultantIndex({
  rows,
  countrySlug,
  where,
  guides = [],
}: {
  rows: CountryConsultantRow[];
  countrySlug: string;
  /** The destination as it reads in a sentence: "the United Kingdom". */
  where: string;
  /** The destinations with a published guide, for the cards' badges. */
  guides?: readonly string[];
}) {
  const path = usePathname();
  const params = useSearchParams();
  const state = readConsultantState(params);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState('');

  const options = consultantOptions(rows);
  const known = (list: ConsultantFilterOption[], values: string[]) =>
    values.filter((value) => list.some((option) => option.value === value));
  /* Values no consultant here carries -- a city from another destination's
     link, a service typed by hand -- are set aside rather than allowed to
     empty the list. */
  const filters: ConsultantListState = {
    ...state,
    cities: known(options.cities, state.cities),
    services: known(options.services, state.services),
    languages: state.languages.filter((value) =>
      options.languages.some(
        (option) => option.value === value || option.label.toLowerCase() === value,
      ),
    ),
  };
  const shown = filterConsultants(rows, filters);
  const active = activeConsultantFilters(filters);
  const narrowed = active > 0 || filters.q !== '';
  const visible = Math.min(shown.length, filters.page * CONSULTANT_STEP);
  const total = rows.length;

  const groups = {
    cities: narrowsConsultants(options.cities, total) || filters.cities.length > 0,
    services: narrowsConsultants(options.services, total) || filters.services.length > 0,
    languages: narrowsConsultants(options.languages, total) || filters.languages.length > 0,
    verified: (options.verified > 0 && options.verified < total) || filters.verified,
  };
  const hasFilters = Object.values(groups).some(Boolean);

  const commit = (next: Partial<ConsultantListState>, keepPage = false) => {
    const merged: ConsultantListState = {
      ...filters,
      ...next,
      ...(keepPage ? {} : { page: 1 }),
    };
    window.history.replaceState(null, '', consultantListHref(path, merged));
    if (!keepPage) setStatus('');
  };

  const toggle = (key: 'cities' | 'services' | 'languages', value: string) => {
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
    const added = Math.min(CONSULTANT_STEP, shown.length - visible);
    commit({ page: filters.page + 1 }, true);
    setStatus(`${added} more ${added === 1 ? 'consultant' : 'consultants'} loaded`);
  };

  const noun = (count: number) => (count === 1 ? 'consultant' : 'consultants');

  const group = (
    title: string,
    key: 'cities' | 'services' | 'languages',
    list: ConsultantFilterOption[],
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
    <section className="sec sec--white sec--tight" id="consultants" aria-labelledby="results-heading">
      <div className="wrap">
        <h2 className="sr-only" id="results-heading">
          Consultants for {where}
        </h2>
        <div className={hasFilters ? 'results' : 'results results--open'}>
          {hasFilters ? (
            <aside
              className="filters-panel filters-panel--live"
              id="cons-filters"
              data-open={String(filtersOpen)}
              aria-label="Consultant filters"
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
                {groups.cities ? group('Consultant location', 'cities', options.cities) : null}
                {groups.services ? group('Service', 'services', options.services) : null}
                {groups.languages ? group('Language', 'languages', options.languages) : null}
                {groups.verified ? (
                  <div className="fgroup">
                    <p className="fgroup__t">Verification</p>
                    <div className="fgroup__opts">
                      <label className="fcheck">
                        <input
                          type="checkbox"
                          checked={filters.verified}
                          onChange={() => commit({ verified: !filters.verified })}
                        />
                        <span>Verified by Universta</span>
                        <em>{options.verified}</em>
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
                    aria-controls="cons-filters"
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
                    <span className="sr-only">Sort consultants</span>
                    <select
                      value={filters.sort}
                      onChange={(event) =>
                        commit({ sort: event.target.value as ConsultantSort })
                      }
                    >
                      {CONSULTANT_SORTS.map((option) => (
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
              <div className="consultgrid">
                {shown.slice(0, visible).map((row) => (
                  <ConsultantCard
                    key={row.id}
                    consultant={row}
                    countrySlug={countrySlug}
                    guides={guides}
                  />
                ))}
              </div>
            ) : (
              <div className="dir__none">
                <p>
                  {total === 0
                    ? `No consultant on Universta lists ${where} yet.`
                    : narrowed
                      ? 'No consultant matches that. Try a shorter word, or clear the filters.'
                      : 'No consultant matches that.'}
                </p>
                {narrowed ? clearLink('Clear filters', 'btn btn--sm btn--ghost') : null}
              </div>
            )}

            {shown.length > CONSULTANT_STEP ? (
              <div className="unimore">
                <span className="results__count">
                  Showing {visible} of {shown.length}
                </span>
                {visible < shown.length ? (
                  <>
                    <button className="btn btn--ghost" type="button" onClick={loadMore}>
                      Load more consultants
                    </button>
                    <noscript>
                      <a
                        className="btn btn--ghost"
                        rel="nofollow"
                        href={`${consultantListHref(path, { ...filters, page: filters.page + 1 })}#consultants`}
                      >
                        Show more consultants
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

            {/* The directory's own words for both, so the two pages cannot
                describe the same badge differently. */}
            <p className="trust__note">
              Listed in the catalogue&rsquo;s order: there is no paid placement and
              no ranking. &ldquo;Verified&rdquo; means an administrator has checked the
              record against a source and dated that check; an unverified profile is
              still published, just not yet checked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

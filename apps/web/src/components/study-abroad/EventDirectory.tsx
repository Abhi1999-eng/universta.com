'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useNow } from './EventClock';
import {
  activeEventFilters,
  EVENT_SORTS,
  eventFilterOptions,
  eventFiltersHref,
  filterEvents,
  readEventFilters,
  type EventFilterState,
  type EventItem,
  type EventOption,
  type EventSort,
} from '@/lib/event-filters';

/**
 * The events directory in the zip's finder layout: a search box over a
 * filter panel (Format, Country, When, Upcoming or past) and the results,
 * with a sort and, on a phone, the panel as a drawer behind a Filters
 * button. Upcoming events come first, soonest first; past ones follow in
 * their own band, newest first, so every event stays reachable.
 *
 * It narrows the events the page loaded, in the browser, writing each
 * choice into the address. A group that would not narrow anything -- one
 * format, no countries -- is left out rather than drawn as an "All" row.
 */
export function EventDirectory({ items, serverNow }: { items: Array<EventItem & { node: ReactNode }>; serverNow: number }) {
  const path = usePathname();
  const params = useSearchParams();
  const now = useNow(serverNow);
  const state = readEventFilters(params);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(state.q);
  const [seenQuery, setSeenQuery] = useState(state.q);
  /* The box follows the address, so Back and "Clear all" leave it right. */
  if (seenQuery !== state.q) {
    setSeenQuery(state.q);
    setQuery(state.q);
  }

  const options = eventFilterOptions(items, now);
  const filters: EventFilterState = {
    ...state,
    formats: state.formats.filter((value) => options.formats.some((option) => option.value === value)),
    countries: state.countries.filter((value) => options.countries.some((option) => option.value === value)),
  };
  const { upcoming, past } = filterEvents(items, filters, now);
  const active = activeEventFilters(filters);
  const narrowed = active > 0 || filters.q.trim() !== '';

  const groups = {
    formats: options.formats.length > 1 || filters.formats.length > 0,
    countries: options.countries.length > 1 || filters.countries.length > 0,
    when: options.upcoming > 0 || filters.when !== '',
    show: (options.upcoming > 0 && options.past > 0) || filters.show !== '',
  };

  const commit = (next: Partial<EventFilterState>) => {
    window.history.replaceState(null, '', eventFiltersHref(path, { ...filters, ...next }));
  };
  const clear = () => {
    setQuery('');
    window.history.replaceState(null, '', path);
  };
  const toggle = (key: 'formats' | 'countries', value: string) => {
    const list = filters[key];
    commit({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });
  };

  const checks = (title: string, key: 'formats' | 'countries', list: EventOption[]) => (
    <div className="fgroup">
      <p className="fgroup__t">{title}</p>
      <div className={list.length > 8 ? 'fgroup__opts fgroup__opts--scroll' : 'fgroup__opts'}>
        {list.map((option) => (
          <label className="fcheck" key={option.value}>
            <input type="checkbox" checked={filters[key].includes(option.value)} onChange={() => toggle(key, option.value)} />
            <span>{option.label}</span>
            <em>{option.count}</em>
          </label>
        ))}
      </div>
    </div>
  );

  const radios = <T extends string>(
    title: string,
    name: string,
    value: T,
    list: ReadonlyArray<{ value: T; label: string; count?: number }>,
    pick: (value: T) => void,
  ) => (
    <div className="fgroup">
      <p className="fgroup__t">{title}</p>
      <div className="fgroup__opts">
        {list.map((option) => (
          <label className="fcheck" key={option.value || 'any'}>
            <input type="radio" name={name} checked={value === option.value} onChange={() => pick(option.value)} />
            <span>{option.label}</span>
            {option.count !== undefined ? <em>{option.count}</em> : null}
          </label>
        ))}
      </div>
    </div>
  );

  const hasFilters = Object.values(groups).some(Boolean);

  return (
    <div className="eventdir">
      <form
        className="bigsearch bigsearch--sm eventdir__search"
        role="search"
        action={path}
        onSubmit={(event) => {
          event.preventDefault();
          commit({ q: query });
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="1.7" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className="bigsearch__input"
          type="search"
          name="q"
          value={query}
          placeholder="Search events by name, place or format"
          aria-label="Search events"
          autoComplete="off"
          maxLength={100}
          onChange={(event) => {
            setQuery(event.target.value);
            commit({ q: event.target.value });
          }}
        />
      </form>

      <div className={hasFilters ? 'results' : 'results results--open'}>
        {hasFilters ? (
          <aside className="filters-panel filters-panel--live" id="event-filters" data-open={String(open)} aria-label="Event filters">
            <div className="filters-panel__head">
              <span className="filters-panel__title">Filters</span>
              {narrowed ? (
                <button className="linkbtn" type="button" onClick={clear}>
                  Clear all
                </button>
              ) : null}
              <button className="cs__close filters-panel__close" type="button" onClick={() => setOpen(false)} aria-label="Close filters">
                &times;
              </button>
            </div>
            <div className="filters-panel__body">
              {groups.formats ? checks('Format', 'formats', options.formats) : null}
              {groups.countries ? checks('Country', 'countries', options.countries) : null}
              {groups.when
                ? radios(
                    'When',
                    'event-when',
                    filters.when,
                    [...options.windows, { value: '' as const, label: 'Any time' }],
                    (when) => commit({ when }),
                  )
                : null}
              {groups.show
                ? radios(
                    'Upcoming or past',
                    'event-show',
                    filters.show,
                    [
                      { value: 'upcoming' as const, label: 'Upcoming', count: options.upcoming },
                      { value: 'past' as const, label: 'Past', count: options.past },
                      { value: '' as const, label: 'Both' },
                    ],
                    (show) => commit({ show }),
                  )
                : null}
            </div>
            <div className="filters-panel__foot">
              <button className="btn btn--sm btn--block" type="button" onClick={() => setOpen(false)}>
                Show events
              </button>
            </div>
          </aside>
        ) : null}

        <div className="results__main">
          <div className="results__bar">
            <span className="results__count">{filters.show === 'past' ? 'Past events, newest first' : 'Upcoming first'}</span>
            <div className="results__tools">
              {hasFilters ? (
                <button
                  className="chipbtn filters-toggle"
                  type="button"
                  aria-controls="event-filters"
                  aria-expanded={open}
                  onClick={() => setOpen(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M3 6h18M7 12h10M11 18h2" />
                  </svg>
                  Filters {active ? <em>{active}</em> : null}
                </button>
              ) : null}
              <label className="sortsel">
                <span className="sr-only">Sort events</span>
                <select value={filters.sort} onChange={(event) => commit({ sort: event.target.value as EventSort })}>
                  {EVENT_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {filters.show !== 'past' ? (
            upcoming.length ? (
              <div className="schgrid" data-band="upcoming">
                {upcoming.map((item) => (
                  <Card key={item.key}>{item.node}</Card>
                ))}
              </div>
            ) : (
              <div className="dir__none" role="status">
                <p>{narrowed ? 'No upcoming event matches that.' : 'No upcoming events are scheduled just now.'}</p>
                {narrowed ? (
                  <button className="btn btn--sm btn--ghost" type="button" onClick={clear}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )
          ) : null}

          {past.length ? (
            <div className="eventdir__past" id="past-events">
              <div className="h-head">
                <p className="eyebrow eyebrow--plain">Already held</p>
                <h3 className="sec-title">Past events</h3>
              </div>
              <div className="schgrid" data-band="past">
                {past.map((item) => (
                  <Card key={item.key}>{item.node}</Card>
                ))}
              </div>
            </div>
          ) : filters.show === 'past' ? (
            <div className="dir__none" role="status">
              <p>No past event matches that.</p>
              <button className="btn btn--sm btn--ghost" type="button" onClick={clear}>
                Clear filters
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A card as the server drew it; the key belongs to this wrapper. */
function Card({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

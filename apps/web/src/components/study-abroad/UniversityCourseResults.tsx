'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useOptimistic, useState, useTransition } from 'react';
import {
  activeChips,
  activeFilterCount,
  COURSE_FILTER_GROUPS,
  COURSE_SORTS,
  courseApiParams,
  courseListSearch,
  readCourseFilters,
  type CourseFacets,
  type CourseFilterKey,
  type CourseFilters,
  type OfferingCardData,
} from '@/lib/university-courses';
import { OfferingCard } from './OfferingCard';

/**
 * A university's courses: the design's results block, behaving like the
 * reference's course list.
 *
 * The parts are the design's own -- the search bar, the filter panel with a
 * count beside every option, the bar with the count and the sort, the chips
 * for what is in force, the grid of course cards and "Load more". What they
 * do is the reference's: every filter and the sort live in the address, so
 * the server answers each change and a filtered list can be linked to;
 * eighteen courses show first and "Load more courses" appends the next
 * eighteen in place; each chip removes one filter and leaves the rest.
 *
 * How far the list has been loaded is in the address too, as the university
 * lists keep it: ?page=3 is the first three pages of eighteen. "Load more"
 * writes it there as it appends, so a reload, or Back from a course, comes
 * to the same place rather than to the first eighteen.
 *
 * Without script the panel is still a form that submits, and "Show more
 * courses" is a link to the next page of the same run, so nothing here
 * depends on the browser to work.
 */

export type CourseResultsProps = {
  /** The list's own address, without a query. */
  base: string;
  universitySlug: string;
  universityName: string;
  filters: CourseFilters;
  facets: CourseFacets;
  cards: OfferingCardData[];
  /** `page` is how many pages of eighteen `cards` holds, from the first. */
  meta: { page: number; limit: number; total: number; totalPages: number };
  /** Every course the university publishes, filtered or not. */
  catalogueTotal: number;
};

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

export function UniversityCourseResults(props: CourseResultsProps) {
  const { base, filters, facets, meta } = props;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);

  /* The search field follows the address, so the back button and a shared
     link land on the same search rather than an empty box. */
  const [query, setQuery] = useState(filters.q);
  const [seenQuery, setSeenQuery] = useState(filters.q);
  if (seenQuery !== filters.q) {
    setSeenQuery(filters.q);
    setQuery(filters.q);
  }

  /* What "Load more" has appended. A new set of filters is a new list, so
     the appended pages belong to the old one and are dropped. */
  const listKey = courseListSearch(filters, { page: meta.page });
  const [loaded, setLoaded] = useState<{
    key: string;
    cards: OfferingCardData[];
    page: number;
  }>({ key: listKey, cards: [], page: meta.page });
  if (loaded.key !== listKey)
    setLoaded({ key: listKey, cards: [], page: meta.page });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const cards = [...props.cards, ...loaded.cards];
  const lastPage = loaded.page;
  const more = lastPage < meta.totalPages;

  /* Back from a course can bring the list back as the server first drew
     it, under an address "Load more" had since moved on, so the page holds
     fewer courses than its address names. Asked again, the server draws
     the whole run the address names. A press of the button moves the list
     and the address together, so it never sets this off. */
  const inAddress = readCourseFilters(useSearchParams()).page;
  useEffect(() => {
    if (!loading && inAddress > lastPage && lastPage < meta.totalPages)
      router.refresh();
  }, [inAddress, lastPage, loading, meta.totalPages, router]);

  /* What the panel shows while the server answers: a ticked box stays
     ticked at once, and a second tick builds on the first rather than on
     the address the first has not reached yet. */
  const [shown, setShown] = useOptimistic(filters);
  const go = (change: Partial<CourseFilters>) => {
    const next = { ...shown, page: 1, ...change };
    const href = `${base}${courseListSearch(next)}`;
    startTransition(() => {
      setShown(next);
      router.push(href, { scroll: false });
    });
  };

  const toggle = (key: CourseFilterKey, value: string) =>
    go({
      [key]: shown[key].includes(value)
        ? shown[key].filter((entry) => entry !== value)
        : [...shown[key], value],
    });

  async function loadMore() {
    setLoading(true);
    setStatus('');
    try {
      const params = new URLSearchParams({
        university: props.universitySlug,
        ...courseApiParams(filters, lastPage + 1),
      });
      const response = await fetch(`/api/university-courses?${params}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        cards?: OfferingCardData[];
        meta?: { page: number };
      };
      const next = body.cards ?? [];
      const reached = body.meta?.page ?? lastPage + 1;
      setLoaded((current) =>
        current.key === listKey
          ? {
              key: listKey,
              cards: [
                ...current.cards,
                ...next.filter(
                  (card) =>
                    !cards.some((existing) => existing.slug === card.slug),
                ),
              ],
              page: reached,
            }
          : current,
      );
      /* Into the address in place, as the university lists do: no new
         history entry for each press, and no round trip to the server. */
      window.history.replaceState(
        null,
        '',
        `${base}${courseListSearch(filters, { page: reached })}${window.location.hash}`,
      );
      setStatus(`${plural(next.length, 'more course')} loaded.`);
    } catch {
      setStatus('More courses could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const active = activeFilterCount(filters);
  const chips = activeChips(filters, facets);
  /* A group with one option that covers every course narrows nothing, so it
     is left out -- unless it is in force, when it has to stay to be undone. */
  const groups = COURSE_FILTER_GROUPS.map((group) => ({
    ...group,
    options: facets[group.key],
  })).filter(
    (group) =>
      filters[group.key].length > 0 ||
      group.options.length > 1 ||
      (group.options.length === 1 &&
        group.options[0]!.count < props.catalogueTotal),
  );
  const hasPanel = groups.length > 0;
  const hidden = Object.entries(courseApiParams(filters, 1)).filter(
    ([key]) => key !== 'limit' && key !== 'page' && key !== 'q',
  );

  return (
    <div className="cresults">
      <form
        className="bigsearch bigsearch--sm cresults__search"
        role="search"
        action={base}
        method="get"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: query.trim() });
        }}
      >
        <svg
          width="17"
          height="17"
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
          placeholder="Search by course, subject or level"
          aria-label="Search courses"
          autoComplete="off"
          maxLength={100}
        />
        {/* Without script the search keeps the filters already in force. */}
        {hidden.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button className="btn btn--sm" type="submit">
          Search
        </button>
      </form>

      <div className={hasPanel ? 'results' : 'results results--open'}>
        {hasPanel ? (
          <aside
            className="filters-panel filters-panel--live"
            id="course-filters"
            data-open={String(panelOpen)}
            aria-label="Course filters"
          >
            <div className="filters-panel__head">
              <span className="filters-panel__title">Filters</span>
              {active ? (
                <Link
                  className="linkbtn"
                  href={`${base}${courseListSearch(filters, {
                    level: [],
                    subject: [],
                    specialization: [],
                    duration: [],
                    intake: [],
                    studyMode: [],
                    scholarship: false,
                  })}`}
                  scroll={false}
                >
                  Clear all
                </Link>
              ) : null}
              <button
                className="cs__close filters-panel__close"
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close filters"
              >
                &times;
              </button>
            </div>

            <form
              id="course-filter-form"
              className="filters-panel__body"
              action={base}
              method="get"
              onSubmit={(event) => event.preventDefault()}
            >
              {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
              {groups.map((group) => (
                <div
                  className="fgroup"
                  key={group.key}
                  role="group"
                  aria-labelledby={`course-filter-${group.key}`}
                >
                  <p className="fgroup__t" id={`course-filter-${group.key}`}>
                    {group.label}
                  </p>
                  <div
                    className={`fgroup__opts${
                      group.options.length > 8 ? ' fgroup__opts--scroll' : ''
                    }`}
                  >
                    {group.options.map((option) => (
                      <label className="fcheck" key={option.value}>
                        <input
                          type="checkbox"
                          name={group.key}
                          value={option.value}
                          checked={shown[group.key].includes(option.value)}
                          onChange={() => toggle(group.key, option.value)}
                        />
                        <span>{option.label}</span>
                        <em>{option.count.toLocaleString('en-GB')}</em>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <noscript>
                <button className="btn btn--sm btn--block" type="submit">
                  Apply filters
                </button>
              </noscript>
            </form>

            <div className="filters-panel__foot">
              <button
                className="btn btn--sm btn--block"
                type="button"
                onClick={() => setPanelOpen(false)}
              >
                Show {plural(meta.total, 'course')}
              </button>
            </div>
          </aside>
        ) : null}

        <div className="results__main" aria-busy={pending || undefined}>
          <div className="results__bar">
            <span className="results__count" role="status">
              {pending
                ? 'Updating…'
                : active || filters.q
                  ? `${plural(meta.total, 'course')} of ${props.catalogueTotal.toLocaleString('en-GB')}`
                  : plural(meta.total, 'course')}
            </span>
            <div className="results__tools">
              {hasPanel ? (
                <button
                  className="chipbtn filters-toggle"
                  type="button"
                  aria-controls="course-filters"
                  aria-expanded={panelOpen}
                  onClick={() => setPanelOpen(true)}
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
                <span className="sr-only">Sort courses</span>
                <select
                  name="sort"
                  form={hasPanel ? 'course-filter-form' : undefined}
                  value={shown.sort}
                  onChange={(event) => go({ sort: event.target.value })}
                >
                  {COURSE_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {chips.length ? (
            <div className="activechips" aria-label="Filters in force">
              {chips.map((chip) => (
                <Link
                  key={`${chip.key}-${chip.value}`}
                  className="activechip"
                  href={`${base}${chip.search}`}
                  scroll={false}
                  aria-label={`Remove ${chip.label}`}
                >
                  {chip.label} <span aria-hidden="true">&times;</span>
                </Link>
              ))}
              {chips.length > 1 ? (
                <Link
                  className="activechips__clear linkbtn"
                  href={`${base}${courseListSearch(filters, {
                    q: '',
                    level: [],
                    subject: [],
                    specialization: [],
                    duration: [],
                    intake: [],
                    studyMode: [],
                    scholarship: false,
                  })}`}
                  scroll={false}
                >
                  Clear all
                </Link>
              ) : null}
            </div>
          ) : null}

          {cards.length ? (
            <div className="coursegrid" data-testid="course-grid">
              {cards.map((card) => (
                <OfferingCard key={card.slug} course={card} />
              ))}
            </div>
          ) : chips.length ? (
            /* The chips stay above, so the way back is one filter at a time
               rather than all or nothing. */
            <p className="dir__none" data-testid="course-empty">
              No course at {props.universityName} matches these filters. Remove
              a filter to see more.
            </p>
          ) : (
            <p className="dir__none" data-testid="course-empty">
              The list ends before this page.{' '}
              <Link href={`${base}${courseListSearch(filters, { page: 1 })}`}>
                Back to the start of the list
              </Link>
              .
            </p>
          )}

          {cards.length ? (
            <div className="cresults__more">
              <span className="results__count">
                Showing {cards.length.toLocaleString('en-GB')} of{' '}
                {meta.total.toLocaleString('en-GB')}
              </span>
              {more ? (
                <>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    data-testid="course-load-more"
                  >
                    {loading ? 'Loading…' : 'Load more courses'}
                  </button>
                  {/* Without script the button cannot add anything, so a
                      link to the same run one page longer stands in. */}
                  <noscript>
                    <a
                      className="btn btn--ghost"
                      rel="nofollow"
                      href={`${base}${courseListSearch(filters, { page: lastPage + 1 })}#courses`}
                    >
                      Show more courses
                    </a>
                  </noscript>
                </>
              ) : loaded.cards.length || meta.page > 1 ? (
                <span className="cresults__end">
                  You&rsquo;ve reached the end of the list.
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useEffect,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import { PROGRAMME_MAX_PAGES } from '@/lib/courses-params';
import {
  activeChips,
  activeFilterCount,
  COURSE_FILTER_GROUPS,
  courseApiParams,
  courseListSearch,
  ENGLISH_SCORES,
  NO_FILTERS,
  PROGRAMME_COURSE_GROUPS,
  PROGRAMME_SORTS,
  readCourseFilters,
  withoutScope,
  type CourseFacets,
  type CourseFilterKey,
  type CourseFilters,
  type CourseListMeta,
  type CoursePanelGroup,
  type CourseScope,
  type FacetOption,
  type OfferingCardData,
} from '@/lib/university-courses';
import { SearchCombobox } from '@/components/reference/SearchCombobox';
import { OfferingCard } from './OfferingCard';

/**
 * Programmes -- courses as universities teach them -- as the design's
 * results block, behaving like the reference's course directory.
 *
 * The parts are the design's own: the search bar, the filter panel with a
 * count beside every option, the bar with the count and the sort, the chips
 * for what is in force, the grid of course cards and "Load more". What they
 * do is the reference's: every filter and the sort live in the address, so
 * the server answers each change and a filtered list can be linked to;
 * eighteen show first and "Load more courses" appends the next eighteen in
 * place; each chip removes one filter and leaves the rest.
 *
 * The same block serves every list of programmes -- the course finder, a
 * destination's subject pages, a university's own list -- as the
 * reference's one directory does. What a list is fixed to by where it sits
 * (a university, a country and a subject) is its `scope`: sent with every
 * request, but never offered in the panel, chipped or written into the
 * address, which already says it in its path.
 *
 * How far the list has been loaded is in the address too, as the university
 * lists keep it: ?page=3 is the first three pages of eighteen. "Load more"
 * writes it there as it appends, so a reload, or Back from a course, comes
 * to the same place rather than to the first eighteen -- and the list keeps
 * how far down the page the reader was on its own history entry, so Back
 * puts them in front of the course they opened.
 *
 * Without script the panel is still a form that submits, and "Show more
 * courses" is a link to the next page of the same run, so nothing here
 * depends on the browser to work.
 */

export type ProgrammeResultsProps = {
  /** The list's own address, without a query. */
  base: string;
  /** What the list is fixed to by where it sits. */
  scope?: CourseScope;
  filters: CourseFilters;
  facets: CourseFacets;
  cards: OfferingCardData[];
  /** `page` is how many pages of eighteen `cards` holds, from the first. */
  meta: CourseListMeta;
  /** Every programme the list could show, filtered or not. */
  catalogueTotal: number;
  /** The panel's groups, in the order it shows them. */
  groups?: readonly CoursePanelGroup[];
  sorts?: ReadonlyArray<{ value: string; label: string }>;
  /** Where "Load more" asks for the next page of cards. */
  endpoint?: string;
  /** Whether the whole list sits inside one country, so its fees share a
   *  currency whatever is chosen: a university's own list does. */
  oneCurrency?: boolean;
  /** What a card names under its title: the university, across
   *  universities, or the subject, on a university's own list. */
  cardShows?: 'university' | 'subject';
  /** What one result is called: "course" on a university's list. */
  noun?: { one: string; many: string };
  /** Where the list is, for its empty sentence: "at University of Oxford". */
  where?: string;
  placeholder?: string;
  /** Where the search asks what to suggest as the reader types, as the
   *  course finder's has always done; without it the search is a plain
   *  field. A suggestion that names a page of its own opens that page. */
  suggestions?: string;
  /** Said under the empty sentence when the filters match nothing: where
   *  else the reader might look. */
  empty?: ReactNode;
  /** Keeps the panel's ids apart from another list's on the same page. */
  idPrefix?: string;
};

/** How many options a group shows before "Show all". */
const SHOWN = 8;

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const LABELS = Object.fromEntries(
  COURSE_FILTER_GROUPS.map((group) => [group.key, group.label]),
) as Record<CourseFilterKey, string>;

/* The design calls the finder's intake group by its months. */
const GROUP_LABELS: Partial<Record<CourseFilterKey, string>> = {
  intake: 'Intake month',
};

/* Where the list's history entry keeps how far down the page the reader
   was, beside the router's own state. */
const SCROLL_KEY = 'programmeListScroll';

/** How far down the page the reader was when they last left this entry. */
function savedScroll(): number | null {
  const state = window.history.state as Record<string, unknown> | null;
  const value = state?.[SCROLL_KEY];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** One page of eighteen cards from the list's endpoint. `query` is the
 *  list's request without its page. */
async function fetchCards(
  endpoint: string,
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<{ cards: OfferingCardData[]; page: number }> {
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  const response = await fetch(`${endpoint}?${params}`, {
    headers: { accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  const body = (await response.json()) as {
    cards?: OfferingCardData[];
    meta?: { page: number };
  };
  return { cards: body.cards ?? [], page: body.meta?.page ?? page };
}

export function ProgrammeResults(props: ProgrammeResultsProps) {
  const {
    base,
    facets,
    meta,
    scope = {},
    groups: panel = PROGRAMME_COURSE_GROUPS,
    sorts = PROGRAMME_SORTS,
    endpoint = '/api/programmes',
    cardShows = 'university',
    noun = { one: 'programme', many: 'programmes' },
    idPrefix = 'course',
  } = props;
  const filters = withoutScope(props.filters, scope);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  const plural = (count: number, one = noun.one, many = noun.many) =>
    `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`;

  /* The search field follows the address, so the back button and a shared
     link land on the same search rather than an empty box. */
  const [query, setQuery] = useState(filters.q);
  const [seenQuery, setSeenQuery] = useState(filters.q);
  if (seenQuery !== filters.q) {
    setSeenQuery(filters.q);
    setQuery(filters.q);
  }

  /* The fee range is typed, so it waits for "Apply" like a search. */
  const feeKey = `${filters.tuitionMin}|${filters.tuitionMax}`;
  const [fees, setFees] = useState({
    key: feeKey,
    min: filters.tuitionMin,
    max: filters.tuitionMax,
  });
  if (fees.key !== feeKey)
    setFees({ key: feeKey, min: filters.tuitionMin, max: filters.tuitionMax });

  /* What is typed into a long group's own search box. */
  const [finds, setFinds] = useState<Partial<Record<CourseFilterKey, string>>>(
    {},
  );

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

  /* A course is shown once, even when the list moved between two pages
     and the second repeats the end of the first. */
  const seen = new Set<string>();
  const cards = [...props.cards, ...loaded.cards].filter((card) => {
    if (seen.has(card.slug)) return false;
    seen.add(card.slug);
    return true;
  });
  const lastPage = loaded.page;
  const more = lastPage < meta.totalPages;
  /* The request for this list, every page alike but for its number. */
  const apiQuery = new URLSearchParams(
    courseApiParams(filters, 1, scope),
  ).toString();

  /* Back from a course can bring the list back as the server first drew
     it, under an address "Load more" had since moved on, so the page holds
     fewer courses than its address names. The missing pages are asked for
     the way "Load more" asks for them and appended, and the reader is put
     back where they were on the page -- which the list kept on its history
     entry before they left, since the shorter page could not hold that
     place. Never further than the server would draw the address itself.
     A press of the button moves the list and the address together, so it
     never sets this off. */
  const inAddress = Math.min(
    readCourseFilters(useSearchParams()).page,
    PROGRAMME_MAX_PAGES,
  );
  useEffect(() => {
    const target = Math.min(inAddress, meta.totalPages);
    if (target <= lastPage) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const appended: OfferingCardData[] = [];
        let reached = lastPage;
        for (let page = lastPage + 1; page <= target; page += 1) {
          const next = await fetchCards(endpoint, apiQuery, page, controller.signal);
          appended.push(...next.cards);
          reached = next.page;
        }
        /* Drawn at once, so the place the reader left is on the page to
           be put back to. */
        flushSync(() =>
          setLoaded((current) =>
            current.key === listKey
              ? { key: listKey, cards: [...current.cards, ...appended], page: reached }
              : current,
          ),
        );
        const place = savedScroll();
        if (place !== null) window.scrollTo(0, place);
      } catch {
        if (!controller.signal.aborted)
          setStatus(`More ${noun.many} could not be loaded. Try again.`);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    /* A list that has moved on -- new filters, or the address back at the
       start -- needs none of it, and its button is free again. */
    return () => {
      controller.abort();
      setLoading(false);
    };
  }, [apiQuery, endpoint, inAddress, lastPage, listKey, meta.totalPages, noun.many]);

  /* On a phone the panel is a sheet over the page, which closes on Escape
     as the course guides' sheet does. */
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  /* Where the reader is, kept on the list's entry as they leave for a
     course. The router's own state is kept beside it, and the address is
     left as it is. */
  const rememberPlace = (event: React.MouseEvent) => {
    if (!(event.target as Element).closest('a[href]')) return;
    window.history.replaceState(
      { ...window.history.state, [SCROLL_KEY]: window.scrollY },
      '',
    );
  };

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
      const { cards: next, page: reached } = await fetchCards(
        endpoint,
        apiQuery,
        lastPage + 1,
      );
      setLoaded((current) =>
        current.key === listKey
          ? { key: listKey, cards: [...current.cards, ...next], page: reached }
          : current,
      );
      /* Into the address in place, as the university lists do: no new
         history entry for each press, and no round trip to the server.
         Where the reader is goes with it, for the way back. */
      window.history.replaceState(
        { [SCROLL_KEY]: window.scrollY },
        '',
        `${base}${courseListSearch(filters, { page: reached })}${window.location.hash}`,
      );
      setStatus(`${plural(next.length, `more ${noun.one}`, `more ${noun.many}`)} loaded.`);
    } catch {
      setStatus(`More ${noun.many} could not be loaded. Try again.`);
    } finally {
      setLoading(false);
    }
  }

  /* Fees compare only inside one country: the list's own, or the one
     chosen. Across several, the range and "Lowest tuition" are not
     offered, as the API would not apply them. */
  const oneCountry =
    props.oneCurrency ||
    new Set([...(scope.country ?? []), ...filters.country]).size === 1;

  const active = activeFilterCount(filters);
  const chips = activeChips(filters, facets);
  const fixed = new Set(
    (Object.keys(scope) as CourseFilterKey[]).filter(
      (key) => scope[key]?.length,
    ),
  );
  /* A group with one option that covers every course narrows nothing, so it
     is left out -- unless it is in force, when it has to stay to be undone.
     What the list is fixed to is never offered. */
  const offered = (key: CourseFilterKey, options: FacetOption[]) =>
    !fixed.has(key) &&
    (filters[key].length > 0 ||
      options.length > 1 ||
      (options.length === 1 && options[0]!.count < props.catalogueTotal));
  const scoreTests = ENGLISH_SCORES.filter(
    (test) =>
      filters[test.key] ||
      facets.englishTest.some((option) => option.value === test.label),
  );
  const visible = panel.filter((group) => {
    if (group === 'tuition')
      return oneCountry && Boolean(facets.tuition?.count || filters.tuitionMin || filters.tuitionMax);
    if (group === 'scores') return scoreTests.length > 0;
    if (group === 'extras')
      return (
        facets.extras.length > 0 || filters.scholarship || filters.postStudyWork
      );
    return offered(group, facets[group]);
  });
  const hasPanel = visible.length > 0;
  const sortOptions = sorts.filter(
    (option) => option.value !== 'fee' || oneCountry,
  );
  const sortShown = sortOptions.some((option) => option.value === shown.sort)
    ? shown.sort
    : 'relevance';
  const hidden = [
    ...new URLSearchParams(courseListSearch(filters, { q: '' })).entries(),
  ];
  const clearAll = `${base}${courseListSearch(filters, NO_FILTERS)}`;

  const optionRow = (key: CourseFilterKey, option: FacetOption) => (
    <label className="fcheck" key={option.value}>
      <input
        type="checkbox"
        name={key}
        value={option.value}
        checked={shown[key].includes(option.value)}
        onChange={() => toggle(key, option.value)}
      />
      <span>{option.label}</span>
      <em>{option.count.toLocaleString('en-GB')}</em>
    </label>
  );

  const listGroup = (key: CourseFilterKey) => {
    const label = GROUP_LABELS[key] ?? LABELS[key];
    const options = [...facets[key]];
    /* A value in force that the counts do not carry -- a slug nothing
       matches -- is still a box to untick. */
    for (const value of filters[key])
      if (!options.some((option) => option.value === value))
        options.push({ value, label: value, count: 0 });
    const long = options.length > SHOWN;
    const find = fold(finds[key] ?? '').trim();
    let body: ReactNode;
    if (find) {
      const matches = options.filter((option) =>
        fold(option.label).includes(find),
      );
      body = matches.length ? (
        <div className="fgroup__opts fgroup__opts--scroll">
          {matches.map((option) => optionRow(key, option))}
        </div>
      ) : (
        <p className="fgroup__note">Nothing matches “{finds[key]}”.</p>
      );
    } else {
      /* The first few, and any ticked further down, so what is in force
         is always on show; the rest behind "Show all", which works
         without script. */
      const first = options.filter(
        (option, index) =>
          index < SHOWN || filters[key].includes(option.value),
      );
      const rest = options.filter((option) => !first.includes(option));
      body = (
        <>
          <div className="fgroup__opts">
            {first.map((option) => optionRow(key, option))}
          </div>
          {rest.length ? (
            <details className="fgroup__more">
              <summary>
                <span className="fgroup__all">
                  Show all {options.length.toLocaleString('en-GB')}
                </span>
                <span className="fgroup__fewer">Show fewer</span>
              </summary>
              <div className="fgroup__opts fgroup__opts--scroll">
                {rest.map((option) => optionRow(key, option))}
              </div>
            </details>
          ) : null}
        </>
      );
    }
    return (
      <div
        className="fgroup"
        key={key}
        role="group"
        aria-labelledby={`${idPrefix}-filter-${key}`}
      >
        <p className="fgroup__t" id={`${idPrefix}-filter-${key}`}>
          {label}
        </p>
        {long ? (
          <input
            className="fsearch"
            type="search"
            value={finds[key] ?? ''}
            onChange={(event) =>
              setFinds((current) => ({ ...current, [key]: event.target.value }))
            }
            placeholder={`Find a ${label.toLowerCase()}`}
            aria-label={`Find a ${label.toLowerCase()}`}
            autoComplete="off"
          />
        ) : null}
        {body}
        {key === 'status' ? (
          <p className="fgroup__note">
            From the application deadlines recorded for each{' '}
            {noun.one}; one with none recorded is in neither.
          </p>
        ) : null}
      </div>
    );
  };

  const panelGroup = (group: CoursePanelGroup) => {
    if (group === 'tuition')
      return (
        <div
          className="fgroup"
          key="tuition"
          role="group"
          aria-labelledby={`${idPrefix}-filter-tuition`}
        >
          <p className="fgroup__t" id={`${idPrefix}-filter-tuition`}>
            Annual tuition
          </p>
          <div className="pfees">
            <label className="pfees__field">
              <span>Minimum</span>
              <input
                name="tuitionMin"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={fees.min}
                onChange={(event) =>
                  setFees((current) => ({ ...current, min: event.target.value }))
                }
              />
            </label>
            <label className="pfees__field">
              <span>Maximum</span>
              <input
                name="tuitionMax"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={fees.max}
                onChange={(event) =>
                  setFees((current) => ({ ...current, max: event.target.value }))
                }
              />
            </label>
            <button className="btn btn--sm btn--ghost" type="submit">
              Apply
            </button>
          </div>
          <p className="fgroup__note">
            {facets.tuition?.currencyCode
              ? `Amounts in ${facets.tuition.currencyCode}, as each ${noun.one} records its fee. `
              : ''}
            A {noun.one} with no published fee is not left out.
          </p>
        </div>
      );
    if (group === 'scores')
      return (
        <div
          className="fgroup"
          key="scores"
          role="group"
          aria-labelledby={`${idPrefix}-filter-scores`}
        >
          <p className="fgroup__t" id={`${idPrefix}-filter-scores`}>
            My English score
          </p>
          <div className="pscores">
            {scoreTests.map((test) => (
              <label className="pscores__field" key={test.key}>
                <span>{test.label}</span>
                <select
                  name={test.key}
                  value={shown[test.key]}
                  onChange={(event) => go({ [test.key]: event.target.value })}
                >
                  <option value="">Any</option>
                  {[
                    ...new Set([
                      ...test.scores,
                      ...(filters[test.key] ? [filters[test.key]] : []),
                    ]),
                  ].map((score) => (
                    <option key={score} value={score}>
                      {score}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="fgroup__note">
            Shows {noun.many} whose listed minimum is at or below your score.{' '}
            {noun.many[0]!.toUpperCase()}
            {noun.many.slice(1)} without a listed requirement are left out.
          </p>
        </div>
      );
    if (group === 'extras') {
      const extras = [...facets.extras];
      for (const [key, label] of [
        ['scholarship', 'With scholarships'],
        ['postStudyWork', 'Post-study work'],
      ] as const)
        if (filters[key] && !extras.some((option) => option.value === key))
          extras.push({ value: key, label, count: 0 });
      return (
        <div
          className="fgroup"
          key="extras"
          role="group"
          aria-labelledby={`${idPrefix}-filter-extras`}
        >
          <p className="fgroup__t" id={`${idPrefix}-filter-extras`}>
            Extras
          </p>
          <div className="fgroup__opts">
            {extras.map((option) => {
              const key = option.value as 'scholarship' | 'postStudyWork';
              return (
                <label className="fcheck" key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    value="true"
                    checked={shown[key]}
                    onChange={() => go({ [key]: !shown[key] })}
                  />
                  <span>{option.label}</span>
                  <em>{option.count.toLocaleString('en-GB')}</em>
                </label>
              );
            })}
          </div>
        </div>
      );
    }
    return listGroup(group);
  };

  const searchLabel = `Search ${noun.many}`;
  const searchPlaceholder =
    props.placeholder ?? 'Search courses, universities, specializations or cities';
  /* Without script the search keeps the filters already in force. */
  const hiddenFields = hidden.map(([key, value]) => (
    <input key={key} type="hidden" name={key} value={value} />
  ));

  return (
    <div className="cresults">
      {props.suggestions ? (
        <SearchCombobox
          className="cresults__search"
          label={searchLabel}
          placeholder={searchPlaceholder}
          submitLabel="Search"
          endpoint={props.suggestions}
          emptyMessage={`No ${noun.many} found.`}
          value={query}
          onValueChange={setQuery}
          onSubmit={(term) => go({ q: term.trim() })}
          iconSubmit
          /* A university's programmes are this list narrowed, so they open
             in place as a search does; a programme opens its own page. */
          onFollow={(href) => {
            if (!href.startsWith(`${base}?`)) return router.push(href);
            startTransition(() => router.push(href, { scroll: false }));
          }}
          action={base}
          name="q"
          maxLength={100}
        >
          {hiddenFields}
        </SearchCombobox>
      ) : (
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
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            autoComplete="off"
            maxLength={100}
          />
          {hiddenFields}
          <button className="btn btn--sm" type="submit">
            Search
          </button>
        </form>
      )}

      <div className={hasPanel ? 'results' : 'results results--open'}>
        {/* The page behind the open sheet is dimmed, and a tap on it closes
            the sheet, as on the course guides. At the desktop width the
            panel is a column and the stylesheet hides this. */}
        {hasPanel && panelOpen ? (
          <button
            type="button"
            className="cref-overlay"
            aria-label="Close filters"
            onClick={() => setPanelOpen(false)}
          />
        ) : null}
        {hasPanel ? (
          <aside
            className="filters-panel filters-panel--live"
            id={`${idPrefix}-filters`}
            data-open={String(panelOpen)}
            aria-label="Course filters"
          >
            <div className="filters-panel__head">
              <span className="filters-panel__title">Filters</span>
              {active ? (
                <Link
                  className="linkbtn"
                  href={clearAll}
                  rel="nofollow"
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
              id={`${idPrefix}-filter-form`}
              className="filters-panel__body"
              action={base}
              method="get"
              onSubmit={(event) => {
                event.preventDefault();
                go({ tuitionMin: fees.min.trim(), tuitionMax: fees.max.trim() });
              }}
            >
              {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
              {visible.map(panelGroup)}
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
                Show {plural(meta.total)}
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
                  ? `${plural(meta.total)} of ${props.catalogueTotal.toLocaleString('en-GB')}`
                  : plural(meta.total)}
            </span>
            <div className="results__tools">
              {hasPanel ? (
                <button
                  className="chipbtn filters-toggle"
                  type="button"
                  aria-controls={`${idPrefix}-filters`}
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
                <span className="sr-only">Sort {noun.many}</span>
                <select
                  name="sort"
                  form={hasPanel ? `${idPrefix}-filter-form` : undefined}
                  value={sortShown}
                  onChange={(event) => go({ sort: event.target.value })}
                >
                  {sortOptions.map((option) => (
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
                  rel="nofollow"
                  scroll={false}
                  aria-label={`Remove ${chip.label}`}
                >
                  {chip.label} <span aria-hidden="true">&times;</span>
                </Link>
              ))}
              {chips.length > 1 ? (
                <Link
                  className="activechips__clear linkbtn"
                  href={`${base}${courseListSearch(filters, { ...NO_FILTERS, q: '' })}`}
                  rel="nofollow"
                  scroll={false}
                >
                  Clear all
                </Link>
              ) : null}
            </div>
          ) : null}

          {cards.length ? (
            <div
              className="coursegrid"
              data-testid="course-grid"
              onClickCapture={rememberPlace}
            >
              {cards.map((card) => (
                <OfferingCard key={card.slug} course={card} show={cardShows} />
              ))}
            </div>
          ) : chips.length ? (
            /* The chips stay above, so the way back is one filter at a time
               rather than all or nothing. */
            <div className="dir__none" data-testid="course-empty">
              <p>
                {`No ${noun.one}${props.where ? ` ${props.where}` : ''} matches these filters. Remove a filter to see more.`}
              </p>
              {/* On its own, so what a page hands in is never one of a
                  list of children. */}
              {props.empty ? <div>{props.empty}</div> : null}
            </div>
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
                    {loading ? 'Loading…' : `Load more ${noun.many}`}
                  </button>
                  {/* Without script the button cannot add anything, so a
                      link to the same run one page longer stands in. */}
                  <noscript>
                    <a
                      className="btn btn--ghost"
                      rel="nofollow"
                      href={`${base}${courseListSearch(filters, { page: lastPage + 1 })}#courses`}
                    >
                      {`Show more ${noun.many}`}
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

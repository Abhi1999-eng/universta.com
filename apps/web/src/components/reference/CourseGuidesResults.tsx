'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Course, CourseFilterOptions } from '@/lib/catalog';
import {
  GUIDE_DEFAULT_SORT,
  GUIDE_MULTI_KEYS,
  guideFilterCount,
  guideListSearch,
  NO_GUIDE_FILTERS,
  programmeOnlyEntries,
  type GuideFilters,
  type GuideMultiKey,
  type GuideUnknown,
} from '@/lib/courses-params';
import { formatNumber } from '@/lib/format';
import { intakeRange } from '@/lib/intake-range';
import { useStudyAbroadShell } from '@/components/study-abroad/StudyAbroadShell';
import { pagerPages } from './pager-pages';
import { SearchCombobox } from './SearchCombobox';

/**
 * The course guides: /courses?view=guides, the generic course search the
 * page had before it listed programmes, kept whole as the page's second
 * view -- its filters, its address names, its reveal-then-pager and its
 * cards.
 *
 * What changed is what did not work. The filter form is the panel's own
 * scrolling body again, so on a phone the sheet scrolls inside itself and
 * "Apply filters" stays at its foot (a form wrapped around the body and
 * the foot had broken the panel's column, and the lower groups and the
 * button could not be reached). A long group shows its first eight with
 * its own search and "Show all", and a value in force always stays in
 * view. What is in force shows as chips above the cards, each removing one
 * value. Applying lands on the results rather than the top of the page.
 * A card's "Check eligibility" opens the assessment rather than a blank
 * counselling form, and its Compare tick -- which could never compare a
 * course guide with anything -- is a link to the programmes that teach the
 * course, where compare works, on the cards of the courses some live
 * programme teaches.
 *
 * The programmes' own filters -- a university, a city, an English score --
 * mean nothing to the guides, so they are not applied or chipped here; the
 * guides' addresses carry them unchanged, so the way back to the
 * programmes finds them still in force.
 */

export type CourseGuidesResultsProps = {
  courses: Course[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  /** The options and their counts for the list as it is filtered. */
  filterOptions: CourseFilterOptions;
  filters: GuideFilters;
  /** Places and fields in the address that match nothing in the catalogue. */
  unknown: GuideUnknown;
  /** True when the reader asked for a page or a page size themselves, which is
   * what tells the progressive reveal to stand aside for a real pager. */
  paged: boolean;
  /** Whether programmes are the page's default view, so this list's own
   *  address has to say ?view=guides. */
  viewParam: boolean;
  /** Whether the catalogue lists programmes, which the search then
   *  suggests. */
  programmes: boolean;
  /** The guides on the page that a live programme teaches: only these
   *  link to their programmes, since for any other the link would open an
   *  empty list. */
  taught?: readonly string[];
};

/** The approved reveal: twelve to begin with, twelve more each time, and the
 * pager takes over at the API's ceiling so the far end of a large catalogue
 * stays reachable. */
const PAGE_STEP = 12;
const MAX_REVEAL = 96;

/** How many options a group shows before "Show all". */
const SHOWN = 8;

const GROUP_LABELS: Record<GuideMultiKey, string> = {
  country: 'Destination',
  level: 'Degree level',
  subject: 'Subject',
  subSubject: 'Specialisation',
  studyMode: 'Study mode',
  intake: 'Intake month',
  englishTest: 'English test',
};
/* The rail's order, which is the one the page has always had. */
const GROUP_ORDER: GuideMultiKey[] = [
  'country',
  'level',
  'subject',
  'subSubject',
  'studyMode',
  'intake',
  'englishTest',
];

type Option = { value: string; label: string; count: number };

function canonicalCsv(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function draftFrom(filters: GuideFilters): Record<GuideMultiKey, string[]> {
  return Object.fromEntries(
    GUIDE_MULTI_KEYS.map((key) => [key, filters[key]]),
  ) as Record<GuideMultiKey, string[]>;
}

const fold = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

/** Connectives carry no identity, so "Doctor of Philosophy" reads as "DP" and
 * "Health & Medicine" as "HM" rather than "DO" and "H&". A single-word name
 * falls back to its first two letters, which is what makes a tile say "CO"
 * instead of a lone "C". */
function initials(value: string) {
  const words = value
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word && !SKIP_WORDS.has(word.toLowerCase()));
  if (words.length === 0) return value.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function duration(course: Course) {
  const { min, max, unit } = course.duration;
  if (!min && !max) return null;
  const base = unit ? unit.toLowerCase() : 'months';
  if (min && max && min !== max) return `${min}–${max} ${base}`;
  const value = min ?? max;
  const label = Number(value) === 1 ? base.replace(/s$/, '') : base;
  return `${value} ${label}`;
}

function tuition(course: Course) {
  const selected = course.selectedTuition;
  if (!selected || (!selected.min && !selected.max)) return null;
  const currency = selected.currencyCode ? `${selected.currencyCode} ` : '';
  const amount =
    selected.min && selected.max && selected.min !== selected.max
      ? `${formatNumber(selected.min)}–${formatNumber(selected.max)}`
      : formatNumber(selected.min ?? selected.max);
  if (!amount) return null;
  return `${currency}${amount}`;
}

function nextIntake(course: Course) {
  const first = course.selectedIntakes.find((entry) => entry.intake);
  return first?.intake ? intakeRange(first.intake) : null;
}

/** One row per value the filter can take.
 *
 * A specialization's slug is unique within its subject, so the catalogue holds
 * three separate `artificial-intelligence` records and the endpoint reports one
 * option for each. Filtering by the slug matches all of them -- each row
 * already carries that same total -- so the rail listed "Artificial
 * Intelligence · 5" three times in a row, each ticking the same box. */
export function byValue<T extends { value: string }>(options: T[]): T[] {
  const seen = new Map<string, T>();
  for (const option of options)
    if (!seen.has(option.value)) seen.set(option.value, option);
  return [...seen.values()];
}

/** The card's "Check eligibility": the assessment, filed under the course
 *  guide the student was reading about. */
function EligibilityButton({ course }: { course: Course }) {
  const { openAssessment } = useStudyAbroadShell();
  return (
    <button
      type="button"
      className="linkbtn"
      data-testid="guide-eligibility"
      onClick={() =>
        openAssessment({
          intent: 'course-guide-card',
          sourcePagePath: `/courses/${course.slug}`,
          ...(course.selectedCountry
            ? {
                countrySlug: course.selectedCountry.slug,
                countryName: course.selectedCountry.name,
              }
            : {}),
        })
      }
    >
      Check eligibility
    </button>
  );
}

function AssessmentLink({ children }: { children: ReactNode }) {
  const { openAssessment } = useStudyAbroadShell();
  return (
    <button
      type="button"
      className="linkbtn"
      onClick={() => openAssessment({ intent: 'course-guides-empty' })}
    >
      {children}
    </button>
  );
}

export function CourseGuidesResults(props: CourseGuidesResultsProps) {
  const { courses, meta, filters, filterOptions, viewParam } = props;
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const taught = new Set(props.taught ?? []);

  /* The search field follows the address, so the back button and a shared
     link land on the same search rather than an empty box. */
  const [query, setQuery] = useState(filters.q);
  const [seenQuery, setSeenQuery] = useState(filters.q);
  if (seenQuery !== filters.q) {
    setSeenQuery(filters.q);
    setQuery(filters.q);
  }

  /** A dimension holds several values at once and they OR together, so the URL
   * carries them comma-joined. Sorting on the way out keeps one selection one
   * URL, whatever order the boxes were ticked in. */
  //
  // The re-seed key is the server-resolved filters, not the URL hook: on a
  // back/forward step the URL hook updates a render before the new server
  // props arrive, and keying on it re-seeded the draft from the outgoing
  // page's filters and then never corrected itself.
  const draftKey = JSON.stringify(filters);
  const [draft, setDraft] = useState(() => draftFrom(filters));
  const [draftFor, setDraftFor] = useState(draftKey);
  const [tuitionRange, setTuitionRange] = useState({
    min: filters.minTuition,
    max: filters.maxTuition,
  });
  if (draftFor !== draftKey) {
    // The page moved under us (Apply, back, forward, a browse link). Re-seed
    // the pending selection from it rather than stranding the old draft.
    setDraft(draftFrom(filters));
    setTuitionRange({ min: filters.minTuition, max: filters.maxTuition });
    setDraftFor(draftKey);
  }

  /* What the finds above the long groups hold. */
  const [finds, setFinds] = useState<Partial<Record<GuideMultiKey, string>>>({});

  /** The list's address with one change made, in the guides' own names. */
  function hrefWith(change: Partial<GuideFilters>) {
    return `/courses${guideListSearch(filters, change, { view: viewParam })}`;
  }

  /** One place that turns a filter change into a URL, so the back button and a
   * shared link both keep working. It lands on the results, as the browse
   * links below the list do: on a phone the hero would otherwise fill the
   * screen after every change. */
  function commit(change: Partial<GuideFilters>) {
    router.push(`${hrefWith({ ...change, page: 1 })}#discovery`);
    setDrawerOpen(false);
  }

  /** Applies every pending dimension at once. Ticking a box does not navigate:
   * a visitor narrowing on four axes should pay for one page load, not four. */
  function applyDraft() {
    const change: Partial<GuideFilters> = {};
    for (const key of GUIDE_MULTI_KEYS) change[key] = canonicalCsv(draft[key] ?? []);
    change.minTuition = tuitionRange.min.trim();
    change.maxTuition = tuitionRange.max.trim();
    commit(change);
  }

  function toggleDraft(key: GuideMultiKey, value: string) {
    setDraft((current) => {
      const selected = current[key] ?? [];
      return {
        ...current,
        [key]: selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value],
      };
    });
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  /* Every option a group can take, with any value in force that the counts
     do not carry -- a destination nothing matches -- kept as a box to
     untick. */
  const optionsFor = (key: GuideMultiKey): Option[] => {
    const source: Option[] =
      key === 'country'
        ? filterOptions.countries
        : key === 'level'
          ? filterOptions.levels
          : key === 'subject'
            ? filterOptions.subjects
            : key === 'subSubject'
              ? byValue(filterOptions.subSubjects)
              : key === 'studyMode'
                ? filterOptions.studyModes
                : key === 'intake'
                  ? filterOptions.intakes
                  : filterOptions.englishTests;
    const options = [...source];
    for (const value of filters[key])
      if (!options.some((option) => option.value === value))
        options.push({ value, label: value, count: 0 });
    return options;
  };

  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    options: optionsFor(key),
  })).filter((group) => group.options.length > 0);

  const activeCount = guideFilterCount(filters);

  /** Tuition only means something inside one destination's currency, and the
   * API reports which one is in play. */
  const tuitionCurrency =
    (draft.country ?? []).length === 1 && filterOptions.tuition.enabled
      ? filterOptions.tuition.currencyCode
      : null;

  const labelOf = (key: GuideMultiKey, value: string) =>
    optionsFor(key).find((option) => option.value === value)?.label ?? value;

  /* One chip per value in force, each a link to the list without it -- the
     reference's "Active filters" row. Kept out of the index like the list's
     other narrowed states. */
  const chips: Array<{ key: string; label: string; href: string }> = [];
  if (filters.q)
    chips.push({ key: 'q', label: `“${filters.q}”`, href: hrefWith({ q: '' }) });
  for (const key of GROUP_ORDER)
    for (const value of filters[key])
      chips.push({
        key: `${key}-${value}`,
        label: labelOf(key, value),
        href: hrefWith({ [key]: filters[key].filter((entry) => entry !== value) }),
      });
  if (filters.scholarshipAvailable)
    chips.push({
      key: 'scholarshipAvailable',
      label: 'Scholarships available',
      href: hrefWith({ scholarshipAvailable: false }),
    });
  if (filters.postStudyWorkAvailable)
    chips.push({
      key: 'postStudyWorkAvailable',
      label: 'Post-study work',
      href: hrefWith({ postStudyWorkAvailable: false }),
    });
  const money = (value: string) =>
    `${filterOptions.tuition.currencyCode ? `${filterOptions.tuition.currencyCode} ` : ''}${formatNumber(value)}`;
  if (filters.minTuition)
    chips.push({
      key: 'minTuition',
      label: `Tuition from ${money(filters.minTuition)}`,
      href: hrefWith({ minTuition: '' }),
    });
  if (filters.maxTuition)
    chips.push({
      key: 'maxTuition',
      label: `Tuition up to ${money(filters.maxTuition)}`,
      href: hrefWith({ maxTuition: '' }),
    });
  const clearAll = `${hrefWith({ ...NO_GUIDE_FILTERS, sort: filters.sort })}#discovery`;

  function pageHref(page: number) {
    return hrefWith({ page });
  }

  /** Reveals the next step in place. The page size travels in the URL, so the
   * reader can share or reload what they have opened up -- which a button that
   * only appended rows in memory could not do. */
  function revealHref(size: number) {
    return hrefWith({ pageSize: size, page: 1 });
  }

  const shown = courses.length;
  const revealed = Math.max(meta.limit, shown);
  /* Progressive while there is headroom; the pager takes over at the ceiling,
     and whenever the reader has asked for a page or a size of their own. */
  const canReveal = !props.paged && shown < meta.total && revealed < MAX_REVEAL;
  const showPager = (props.paged || revealed >= MAX_REVEAL) && meta.totalPages > 1;

  const optionRow = (key: GuideMultiKey, option: Option) => (
    <label className="fcheck" key={option.value}>
      <input
        type="checkbox"
        name={key}
        value={option.value}
        checked={(draft[key] ?? []).includes(option.value)}
        onChange={() => toggleDraft(key, option.value)}
      />
      <span>{option.label}</span>
      <em>{formatNumber(option.count)}</em>
    </label>
  );

  const groupBody = (key: GuideMultiKey, label: string, options: Option[]) => {
    const find = fold(finds[key] ?? '').trim();
    if (find) {
      const matches = options.filter((option) => fold(option.label).includes(find));
      return matches.length ? (
        <div className="fgroup__opts fgroup__opts--scroll">
          {matches.map((option) => optionRow(key, option))}
        </div>
      ) : (
        <p className="fgroup__note">Nothing matches “{finds[key]}”.</p>
      );
    }
    /* The first few, and any in force further down, so what is applied is
       always on show; the rest behind "Show all", which works without
       script. */
    const first = options.filter(
      (option, index) => index < SHOWN || filters[key].includes(option.value),
    );
    const rest = options.filter((option) => !first.includes(option));
    return (
      <>
        <div className="fgroup__opts">{first.map((option) => optionRow(key, option))}</div>
        {rest.length ? (
          <details className="fgroup__more">
            <summary>
              <span className="fgroup__all">
                Show all {formatNumber(options.length)}
                <span className="sr-only"> {label.toLowerCase()} options</span>
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
  };

  const countText = `${formatNumber(meta.total)} course${meta.total === 1 ? '' : 's'} ${
    activeCount ? 'match your filters' : filters.q ? 'match your search' : 'published'
  }`;

  return (
    <div className="cresults">
      <SearchCombobox
        className="cresults__search"
        label="Search courses"
        placeholder="Search courses, universities, specializations or cities"
        submitLabel="Find courses"
        endpoint={
          props.programmes
            ? '/api/courses/suggestions?with=programmes'
            : '/api/courses/suggestions'
        }
        emptyMessage="No courses found."
        value={query}
        onValueChange={setQuery}
        onSubmit={(term) => commit({ q: term.trim() })}
        iconSubmit
        /* A university's programmes open at the results, as a search here
           does; a programme opens its own page. */
        onFollow={(href) =>
          router.push(href.startsWith('/courses?') ? `${href}#discovery` : href)
        }
      />

      <div className="results">
        {drawerOpen ? (
          <button
            type="button"
            className="cref-overlay"
            aria-label="Close filters"
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}

        <aside
          id="course-filter-panel"
          className="filters-panel filters-panel--staged"
          /* The reference's drawer slides in on `data-open`; ours tracks
             the same state in React, so it sets the attribute the CSS
             reads. */
          data-open={drawerOpen ? 'true' : 'false'}
          aria-label="Filter courses"
          data-testid="course-filters"
        >
          <div className="filters-panel__head">
            <span className="filters-panel__title">Filters</span>
            {activeCount ? (
              <Link className="linkbtn" href={clearAll} rel="nofollow">
                Clear all
              </Link>
            ) : null}
            <button
              type="button"
              className="cs__close filters-panel__close filter-toggle"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close filters"
            >
              ×
            </button>
          </div>

          {/* The form is the panel's scrolling body itself, and the foot's
              button submits it from outside: wrapped round both, the form
              took the panel's column away and the sheet could not scroll. */}
          <form
            id="course-guide-filters"
            className="filters-panel__body"
            action="/courses"
            method="get"
            data-testid="course-guide-form"
            onSubmit={(event) => {
              event.preventDefault();
              applyDraft();
            }}
          >
            {viewParam ? <input type="hidden" name="view" value="guides" /> : null}
            {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
            {programmeOnlyEntries(filters.programmeOnly).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            {groups.map((group) => (
              <div
                className="fgroup"
                key={group.key}
                role="group"
                aria-labelledby={`guide-filter-${group.key}`}
              >
                <p className="fgroup__t" id={`guide-filter-${group.key}`}>
                  {group.label}
                </p>
                {group.options.length > SHOWN ? (
                  <input
                    className="fsearch"
                    type="search"
                    value={finds[group.key] ?? ''}
                    onChange={(event) =>
                      setFinds((current) => ({ ...current, [group.key]: event.target.value }))
                    }
                    placeholder={`Find a ${group.label.toLowerCase()}`}
                    aria-label={`Find a ${group.label.toLowerCase()}`}
                    autoComplete="off"
                  />
                ) : null}
                {groupBody(group.key, group.label, group.options)}
              </div>
            ))}

            {filterOptions.extras.length ? (
              <div className="fgroup">
                <p className="fgroup__t">Extras</p>
                <div className="fgroup__opts">
                  {filterOptions.extras.map((extra) => {
                    const key = extra.value as 'scholarshipAvailable' | 'postStudyWorkAvailable';
                    const checked = filters[key] === true;
                    return (
                      <label className="fcheck" key={extra.value}>
                        <input
                          type="checkbox"
                          name={key}
                          value="true"
                          checked={checked}
                          onChange={() => commit({ [key]: !checked })}
                        />
                        <span>{extra.label}</span>
                        <em>{formatNumber(extra.count)}</em>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="fgroup">
              <p className="fgroup__t">Annual tuition</p>
              <div className="fgroup__opts">
                {tuitionCurrency ? (
                  <>
                    <label className="frange-field">
                      <span>Minimum</span>
                      <input
                        name="minTuition"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={tuitionRange.min}
                        onChange={(event) =>
                          setTuitionRange((current) => ({
                            ...current,
                            min: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="frange-field">
                      <span>Maximum</span>
                      <input
                        name="maxTuition"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={tuitionRange.max}
                        onChange={(event) =>
                          setTuitionRange((current) => ({
                            ...current,
                            max: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </>
                ) : (
                  <p className="fhelp">
                    {/* Tuition is stored per destination in that
                        destination's own currency, so a range across
                        several is meaningless. */}
                    Select exactly one destination to filter by tuition in a single
                    currency.
                  </p>
                )}
              </div>
              {tuitionCurrency ? (
                <p className="fgroup__note">Amounts in {tuitionCurrency}, per year.</p>
              ) : null}
            </div>
          </form>

          {/* At every width, unlike the programmes' panel: here a tick is
              only staged until this is pressed. */}
          <div className="filters-panel__foot ffoot">
            <button className="btn btn--block" type="submit" form="course-guide-filters">
              Apply filters
            </button>
          </div>
        </aside>

        <div className="results__main">
          <div className="results__bar">
            <span
              className="results__count"
              data-testid="course-count"
              role="status"
              aria-live="polite"
            >
              {countText}
            </span>
            <div className="results__tools">
              <button
                type="button"
                className="chipbtn filters-toggle filter-toggle"
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls="course-filter-panel"
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
                Filters {activeCount ? <em>{activeCount}</em> : null}
              </button>
              {filterOptions.sorts.length > 1 ? (
                <label className="sortsel">
                  <span className="sr-only">Sort courses</span>
                  <select
                    aria-label="Sort courses"
                    value={filters.sort || GUIDE_DEFAULT_SORT}
                    onChange={(event) =>
                      commit({
                        sort:
                          event.target.value === GUIDE_DEFAULT_SORT ? '' : event.target.value,
                      })
                    }
                  >
                    {filterOptions.sorts.map((sort) => (
                      <option key={sort.value} value={sort.value}>
                        {sort.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>

          {chips.length ? (
            <div className="activechips" aria-label="Filters in force">
              {chips.map((chip) => (
                <Link
                  key={chip.key}
                  className="activechip"
                  href={`${chip.href}#discovery`}
                  rel="nofollow"
                  aria-label={`Remove ${chip.label}`}
                >
                  {chip.label} <span aria-hidden="true">&times;</span>
                </Link>
              ))}
              {chips.length > 1 ? (
                <Link
                  className="activechips__clear linkbtn"
                  href={`${hrefWith({ ...NO_GUIDE_FILTERS, sort: filters.sort })}#discovery`}
                  rel="nofollow"
                >
                  Clear all
                </Link>
              ) : null}
            </div>
          ) : null}

          {courses.length === 0 ? (
            <div className="dir__none" data-testid="course-empty">
              <p>No course matches these filters. Remove a filter to see more.</p>
              <p>
                Or <AssessmentLink>run the assessment</AssessmentLink> and we will match
                you against programmes directly.
              </p>
            </div>
          ) : (
            <div className="coursegrid" data-testid="course-guide-grid">
              {courses.map((course) => {
                const dur = duration(course);
                const fee = tuition(course);
                const intake = nextIntake(course);
                return (
                  <article className="coursecard" key={course.id}>
                    <div className="coursecard__top">
                      <span className="coursecard__type">
                        {course.courseLevel.name}
                        {course.qualificationName ? ` · ${course.qualificationName}` : ''}
                      </span>
                      {taught.has(course.slug) ? (
                        <div className="coursecard__tools">
                          {/* A guide is the course itself, which has nothing
                              to be compared with; its programmes -- the same
                              course at each university -- do. */}
                          <Link
                            className="coursecard__compare"
                            href={`/courses?course=${encodeURIComponent(course.slug)}#discovery`}
                          >
                            Compare programmes
                          </Link>
                        </div>
                      ) : null}
                    </div>

                    <h3 className="coursecard__name">
                      <Link href={`/courses/${course.slug}`}>{course.name}</Link>
                    </h3>

                    {/* Where a programme card names one university, this names
                        the subject the course belongs to: a course guide is
                        the generic course, taught by many. */}
                    <Link className="coursecard__uni" href={`/subjects/${course.subject.slug}`}>
                      <span className="unimark unimark--xs" aria-hidden="true">
                        {initials(course.subject.name)}
                      </span>
                      <span>
                        <b>{course.subject.name}</b>
                        {course.selectedCountry ? (
                          <em>{course.selectedCountry.name}</em>
                        ) : course.availableCountryCount ? (
                          <em>
                            {course.availableCountryCount} destination
                            {course.availableCountryCount === 1 ? '' : 's'}
                          </em>
                        ) : null}
                      </span>
                    </Link>

                    {/* A `<dl>` of `<div><dt>/<dd></div>` groups, as the
                        reference has it: the column track and the dividers
                        between facts are written for those groups. */}
                    {dur || fee || intake || course.studyModes.length ? (
                      <dl className="coursecard__facts">
                        {dur ? (
                          <div>
                            <dt>Duration</dt>
                            <dd>{dur}</dd>
                          </div>
                        ) : null}
                        {course.studyModes.length ? (
                          <div>
                            <dt>Study mode</dt>
                            <dd>{course.studyModes[0].name}</dd>
                          </div>
                        ) : null}
                        {fee ? (
                          <div>
                            <dt>Tuition</dt>
                            <dd className="datum">{fee}</dd>
                          </div>
                        ) : null}
                        {intake ? (
                          <div>
                            <dt>Intake</dt>
                            <dd>{intake}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}

                    {course.subSubject || course.scholarshipAvailable ? (
                      <div className="coursecard__tags">
                        {course.subSubject ? (
                          <Link
                            className="tag"
                            href={`/subjects/${course.subject.slug}/${course.subSubject.slug}`}
                          >
                            {course.subSubject.name}
                          </Link>
                        ) : null}
                        {course.scholarshipAvailable ? (
                          <span className="tag">Scholarships</span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="coursecard__foot">
                      <Link className="btn btn--sm" href={`/courses/${course.slug}`}>
                        View course{' '}
                        <span className="btn__arrow" aria-hidden="true">
                          →
                        </span>
                      </Link>
                      <EligibilityButton course={course} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {canReveal ? (
            <div className="cresults__more">
              <span className="results__count">
                Showing {formatNumber(shown)} of {formatNumber(meta.total)}
              </span>
              <Link
                className="btn btn--ghost"
                href={revealHref(Math.min(revealed + PAGE_STEP, MAX_REVEAL))}
                scroll={false}
                rel="nofollow"
              >
                Show more courses
              </Link>
            </div>
          ) : null}

          {showPager ? (
            <nav className="pager" aria-label="Course results pagination">
              <button
                type="button"
                aria-label="Previous results page"
                disabled={meta.page <= 1}
                onClick={() => router.push(`${pageHref(meta.page - 1)}#discovery`)}
              >
                ‹
              </button>
              {pagerPages(meta.page, meta.totalPages).map((item) => (
                <span key={item.page} style={{ display: 'contents' }}>
                  {item.gapBefore ? <span>…</span> : null}
                  {item.page === meta.page ? (
                    <span className="cur">{item.page}</span>
                  ) : (
                    <Link href={`${pageHref(item.page)}#discovery`}>{item.page}</Link>
                  )}
                </span>
              ))}
              <button
                type="button"
                aria-label="Next results page"
                disabled={meta.page >= meta.totalPages}
                onClick={() => router.push(`${pageHref(meta.page + 1)}#discovery`)}
              >
                ›
              </button>
              <span className="pager-status" aria-current="page">
                Page {meta.page} of {meta.totalPages}
              </span>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

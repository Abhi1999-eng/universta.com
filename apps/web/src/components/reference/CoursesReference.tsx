'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { pagerPages } from './pager-pages';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Course, CourseFilterOptions } from '@/lib/catalog';
import { SearchCombobox } from './SearchCombobox';
import { intakeRange } from '@/lib/intake-range';
import { formatNumber } from '@/lib/format';

/** The client-approved Courses page.
 *
 * The approved build is five bands and nothing else: the hero, one white band
 * holding the search, the filter rail and the results, the navy matching band,
 * the navy closing band and the related strip. This page had grown to fourteen
 * -- browse-by-subject, browse-by-level, browse-by-specialisation, a why-us
 * grid, a tools grid, two prose blocks, an FAQ and a second CTA -- so a reader
 * looking for a course scrolled past eleven thousand pixels of marketing to
 * reach a second screen of results. Those blocks are gone; what each of them
 * linked to is reachable from the filter rail, the nav and the related strip.
 *
 * The numbers still differ from the template, which ships "300,000+ programs",
 * QS ranks, STEM badges and graduate salaries as prototype copy. Universta has
 * no ranking, STEM-designation or salary data, so those are omitted rather than
 * faked, and every count here is the real catalogue count.
 *
 * Two things the template does that this cannot. It renders all 55 of its
 * courses into the HTML and filters them in the browser; at 1,854 and climbing
 * the rail filters on the server instead. And its card names one university,
 * because a course there is one university's programme -- here a course is the
 * generic programme and the universities offering it are a relation, so the
 * card names the subject and how many destinations teach it. */

export type CoursesReferenceProps = {
  courses: Course[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filterOptions: CourseFilterOptions;
  filters: Record<string, string>;
  /** True when the reader asked for a page or a page size themselves, which is
   * what tells the progressive reveal to stand aside for a real pager. */
  paged: boolean;
  heading: string;
  lede: string;
};

const MULTI_KEYS = [
  'level',
  'country',
  'subject',
  'subSubject',
  'studyMode',
  'intake',
  'englishTest',
] as const;

/** The approved reveal: twelve to begin with, twelve more each time, and the
 * pager takes over at the API's ceiling so the far end of a large catalogue
 * stays reachable. */
const PAGE_STEP = 12;
const MAX_REVEAL = 96;

function csvValues(value: string | undefined) {
  return value
    ? [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function canonicalCsv(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)).join(',');
}

function draftFrom(filters: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(MULTI_KEYS.map((key) => [key, csvValues(filters[key])]));
}

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

type Facet = { value: string; label: string; count: number };

/** One row per value the filter can take.
 *
 * A specialization's slug is unique within its subject, so the catalogue holds
 * three separate `artificial-intelligence` records and the endpoint reports one
 * option for each. Filtering by the slug matches all of them -- each row
 * already carries that same total -- so the rail listed "Artificial
 * Intelligence · 5" three times in a row, each ticking the same box. */
function byValue(options: Facet[]): Facet[] {
  const seen = new Map<string, Facet>();
  for (const option of options) if (!seen.has(option.value)) seen.set(option.value, option);
  return [...seen.values()];
}

export function CoursesReference(props: CoursesReferenceProps) {
  const { courses, meta, filters, filterOptions } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.q ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compare, setCompare] = useState<Array<{ slug: string; name: string }>>([]);

  /** A dimension holds several values at once and they OR together, so the URL
   * carries them comma-joined. Sorting on the way out keeps one selection one
   * URL, whatever order the boxes were ticked in. */
  //
  // The re-seed key is the server-resolved filters, not `searchParams`: on a
  // back/forward step the URL hook updates a render before the new server
  // props arrive, and keying on it re-seeded the draft from the outgoing
  // page's filters and then never corrected itself.
  const draftKey = JSON.stringify(filters);
  const [draft, setDraft] = useState<Record<string, string[]>>(() => draftFrom(filters));
  const [draftFor, setDraftFor] = useState(draftKey);
  if (draftFor !== draftKey) {
    // The page moved under us (Apply, back, forward, a browse link). Re-seed
    // the pending selection from it rather than stranding the old draft.
    setDraft(draftFrom(filters));
    setDraftFor(draftKey);
  }

  const [tuitionRange, setTuitionRange] = useState({
    min: filters.minTuition ?? '',
    max: filters.maxTuition ?? '',
  });
  const [tuitionFor, setTuitionFor] = useState(draftKey);
  if (tuitionFor !== draftKey) {
    setTuitionRange({ min: filters.minTuition ?? '', max: filters.maxTuition ?? '' });
    setTuitionFor(draftKey);
  }

  /** One place that turns a filter change into a URL, so the back button and a
   * shared link both keep working -- the prototype held filter state in
   * page-local JavaScript and lost it on every reload. */
  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.push(`${pathname}${params.size ? `?${params}` : ''}`);
    setDrawerOpen(false);
  }

  /** Applies every pending dimension at once. Ticking a box does not navigate:
   * a visitor narrowing on four axes should pay for one page load, not four. */
  function applyDraft() {
    const next: Record<string, string | null> = {};
    for (const key of MULTI_KEYS) next[key] = canonicalCsv(draft[key] ?? []) || null;
    next.minTuition = tuitionRange.min.trim() || null;
    next.maxTuition = tuitionRange.max.trim() || null;
    commit(next);
  }

  function toggleDraft(key: string, value: string) {
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

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}`;
  }

  /** Reveals the next step in place. The page size travels in the URL, so the
   * reader can share or reload what they have opened up -- which a button that
   * only appended rows in memory could not do. */
  function revealHref(size: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(size));
    params.delete('page');
    return `${pathname}?${params}`;
  }

  const specialisations = byValue(filterOptions.subSubjects);

  const facetGroups = [
    { key: 'country', label: 'Destination', options: filterOptions.countries },
    { key: 'level', label: 'Degree level', options: filterOptions.levels },
    { key: 'subject', label: 'Subject', options: filterOptions.subjects },
    { key: 'subSubject', label: 'Specialisation', options: specialisations },
    { key: 'studyMode', label: 'Study mode', options: filterOptions.studyModes },
    { key: 'intake', label: 'Intake month', options: filterOptions.intakes },
    { key: 'englishTest', label: 'English test', options: filterOptions.englishTests },
  ].filter((group) => group.options.length > 0);

  const activeCount = Object.keys(filters).filter(
    (key) => !['q', 'sort', 'page', 'pageSize'].includes(key),
  ).length;

  /** Tuition only means something inside one destination's currency, and the
   * API reports which one is in play. */
  const tuitionCurrency =
    (draft.country ?? []).length === 1 && filterOptions.tuition.enabled
      ? filterOptions.tuition.currencyCode
      : null;

  const compareHref = compare.length
    ? `/compare/courses?items=${compare.map((item) => item.slug).join(',')}`
    : '/compare/courses';

  function toggleCompare(course: Course) {
    setCompare((current) => {
      if (current.some((item) => item.slug === course.slug)) {
        return current.filter((item) => item.slug !== course.slug);
      }
      if (current.length >= 3) return current;
      return [...current, { slug: course.slug, name: course.name }];
    });
  }

  /* The template's "Try" row is five hand-written example searches. These are
     the catalogue's own busiest specialisations, so a chip never offers a term
     the search cannot answer. */
  const tryChips = specialisations.slice(0, 5);

  /* Four facts, inline, as the approved hero has them -- and only the ones
     this catalogue can actually count. A figure with nothing behind it is left
     out rather than printed as a dash. */
  const stats = [
    { value: meta.total, label: 'Programmes' },
    { value: filterOptions.countries.length, label: 'Destinations' },
    { value: filterOptions.subjects.length, label: 'Subjects' },
    { value: specialisations.length, label: 'Specialisations' },
  ].filter((stat) => stat.value > 0);

  const shown = courses.length;
  const revealed = Math.max(meta.limit, shown);
  /* Progressive while there is headroom; the pager takes over at the ceiling,
     and whenever the reader has asked for a page or a size of their own. */
  const canReveal = !props.paged && shown < meta.total && revealed < MAX_REVEAL;
  const showPager = (props.paged || revealed >= MAX_REVEAL) && meta.totalPages > 1;

  return (
    <>
      {/* ------------------------------------------------------------ HERO */}
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Courses</span>
          </nav>

          <div className="hero__lead">
            {meta.total ? (
              <p className="hero__eyebrow">
                Course discovery<b>·</b>
                {formatNumber(meta.total)} programmes
                {filterOptions.countries.length ? (
                  <>
                    <b>·</b>
                    {filterOptions.countries.length} destinations
                  </>
                ) : null}
              </p>
            ) : null}
            <h1 className="hero__h1">{props.heading}</h1>
            <p className="hero__sub">{props.lede}</p>
          </div>

          {stats.length ? (
            <div className="statstrip">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <b className="datum">{formatNumber(stat.value)}</b>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <p className="bigsearch__ex" style={{ marginTop: 22 }}>
            <span className="label">Try</span>
            {tryChips.map((chip) => (
              <Link
                key={chip.value}
                className="chipbtn chipbtn--sm"
                href={`/courses?subSubject=${encodeURIComponent(chip.value)}#discovery`}
              >
                {chip.label}
              </Link>
            ))}
            {/* Quick filters toggle a single parameter straight away, so their
                pressed state is the URL rather than page-local memory. */}
            <button
              type="button"
              className={`chipbtn chipbtn--sm${filters.scholarshipAvailable === 'true' ? ' on' : ''}`}
              aria-pressed={filters.scholarshipAvailable === 'true'}
              onClick={() =>
                commit({
                  scholarshipAvailable:
                    filters.scholarshipAvailable === 'true' ? null : 'true',
                })
              }
            >
              Scholarships
            </button>
            <button
              type="button"
              className={`chipbtn chipbtn--sm${filters.postStudyWorkAvailable === 'true' ? ' on' : ''}`}
              aria-pressed={filters.postStudyWorkAvailable === 'true'}
              onClick={() =>
                commit({
                  postStudyWorkAvailable:
                    filters.postStudyWorkAvailable === 'true' ? null : 'true',
                })
              }
            >
              Post-study work
            </button>
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- RESULTS */}
      <section className="sec sec--white sec--tight" id="discovery">
        <div className="wrap">
          {/* The approved band carries no visible title -- the hero has just
              said what this is. An outline still needs the level, or a screen
              reader walking the page drops from the h1 to a card's h3 with
              nothing in between. */}
          <h2 className="sr-only">All courses</h2>
          <div className="cresults">
            <SearchCombobox
              className="cresults__search"
              label="Search courses"
              placeholder="Search courses, universities, specializations or cities"
              submitLabel="Find courses"
              endpoint="/api/courses/suggestions"
              emptyMessage="No courses found."
              value={query}
              onValueChange={setQuery}
              onSubmit={(term) => commit({ q: term.trim() || null })}
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
                className={`filters-panel${drawerOpen ? ' open' : ''}`}
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
                    <Link className="linkbtn" href="/courses#discovery">
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

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyDraft();
                  }}
                >
                  <div className="filters-panel__body fscroll">
                    {facetGroups.map((group) => (
                      <div className="fgroup" key={group.key}>
                        <p className="fgroup__t">{group.label}</p>
                        <div
                          className={`fgroup__opts${
                            group.options.length > 8 ? ' fgroup__opts--scroll' : ''
                          }`}
                        >
                          {group.options.slice(0, 12).map((option) => {
                            const checked = (draft[group.key] ?? []).includes(option.value);
                            return (
                              <label className="fcheck" key={option.value}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDraft(group.key, option.value)}
                                />
                                <span>{option.label}</span>
                                <em>{formatNumber(option.count)}</em>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {filterOptions.extras.length ? (
                      <div className="fgroup">
                        <p className="fgroup__t">Extras</p>
                        <div className="fgroup__opts">
                          {filterOptions.extras.map((extra) => {
                            const checked = filters[extra.value] === 'true';
                            return (
                              <label className="fcheck" key={extra.value}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => commit({ [extra.value]: checked ? null : 'true' })}
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
                  </div>

                  <div className="filters-panel__foot ffoot">
                    <button className="btn btn--block" type="submit">
                      Apply filters
                    </button>
                  </div>
                </form>
              </aside>

              <div className="results__main">
                <div className="results__bar">
                  <span className="results__count" data-testid="course-count">
                    {formatNumber(meta.total)} course{meta.total === 1 ? '' : 's'}{' '}
                    {activeCount ? 'match your filters' : 'published'}
                  </span>
                  <div className="results__tools">
                    <button
                      type="button"
                      className="chipbtn filters-toggle filter-toggle"
                      onClick={() => setDrawerOpen(true)}
                      aria-expanded={drawerOpen}
                      aria-controls="course-filter-panel"
                    >
                      <span aria-hidden="true">☰ </span>
                      Filters{activeCount ? ` (${activeCount})` : ''}
                    </button>
                    {filterOptions.sorts.length > 1 ? (
                      <label className="sortsel">
                        <span className="sr-only">Sort courses</span>
                        <select
                          aria-label="Sort courses"
                          value={filters.sort ?? filterOptions.sorts[0]?.value ?? ''}
                          onChange={(event) => commit({ sort: event.target.value })}
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

                {courses.length === 0 ? (
                  <p className="dir__none" data-testid="course-empty">
                    No course matches those filters.{' '}
                    <Link href="/courses#discovery">Clear them</Link> and start again.
                  </p>
                ) : (
                  <div className="coursegrid">
                    {courses.map((course) => {
                      const dur = duration(course);
                      const fee = tuition(course);
                      const intake = nextIntake(course);
                      const checked = compare.some((item) => item.slug === course.slug);
                      return (
                        <article className="coursecard" key={course.id}>
                          <div className="coursecard__top">
                            <span className="coursecard__type">
                              {course.courseLevel.name}
                              {course.qualificationName ? ` · ${course.qualificationName}` : ''}
                            </span>
                            <div className="coursecard__tools">
                              {/* The template puts a save control here; ours is
                                  the comparison shortlist, which is what this
                                  catalogue actually offers. */}
                              <label className="tinycheck">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!checked && compare.length >= 3}
                                  onChange={() => toggleCompare(course)}
                                />
                                <span>Compare</span>
                              </label>
                            </div>
                          </div>

                          <h3 className="coursecard__name">
                            <Link href={`/courses/${course.slug}`}>{course.name}</Link>
                          </h3>

                          {/* Where the template names one university, this names
                              the subject the programme belongs to: a course here
                              is the generic programme, taught by many. */}
                          <Link
                            className="coursecard__uni"
                            href={`/subjects/${course.subject.slug}`}
                          >
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
                              between facts are written for those groups, and a
                              row of bare spans ran the values into each other
                              with nothing to say which figure was which. */}
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
                            <Link className="linkbtn" href="/counselling">
                              Check eligibility
                            </Link>
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
                      onClick={() => router.push(pageHref(meta.page - 1))}
                    >
                      ‹
                    </button>
                    {pagerPages(meta.page, meta.totalPages).map((item) => (
                      <span key={item.page} style={{ display: 'contents' }}>
                        {item.gapBefore ? <span>…</span> : null}
                        {item.page === meta.page ? (
                          <span className="cur">{item.page}</span>
                        ) : (
                          <Link href={pageHref(item.page)}>{item.page}</Link>
                        )}
                      </span>
                    ))}
                    <button
                      type="button"
                      aria-label="Next results page"
                      disabled={meta.page >= meta.totalPages}
                      onClick={() => router.push(pageHref(meta.page + 1))}
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

          <p className="trust__note" style={{ paddingTop: 20 }}>
            Courses come from universities published in this catalogue. Every course page shows
            when its data was last updated and whether it has been verified.
          </p>
        </div>
      </section>

      {compare.length ? (
        <div className="tray" data-open="true" data-testid="course-compare-tray">
          <div className="wrap tray__inner">
            <span className="tray__label">
              <b>{compare.length}</b> {compare.length === 1 ? 'course' : 'courses'} to compare
            </span>
            <div className="tray__items">
              {compare.map((item) => (
                <span className="tray__item" key={item.slug}>
                  <span className="tray__itemname">{item.name}</span>
                  <button
                    type="button"
                    className="tray__remove"
                    aria-label={`Remove ${item.name} from comparison`}
                    onClick={() =>
                      setCompare((current) => current.filter((entry) => entry.slug !== item.slug))
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="tray__actions">
              <button type="button" className="linkbtn" onClick={() => setCompare([])}>
                Clear
              </button>
              <Link href={compareHref} className="btn btn--sm">
                Compare {compare.length}{' '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

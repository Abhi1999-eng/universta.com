'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Course, CourseFilterOptions, Subject } from '@/lib/catalog';
import { SearchCombobox } from './SearchCombobox';
import { intakeRange } from '@/lib/intake-range';
import { formatNumber } from '@/lib/format';

/** The client-approved Courses page.
 *
 * Section order, hero composition, the filter rail, the result card and every
 * browse block follow the approved template. The numbers do not: the template
 * ships "300,000+ programs", "12,000+ universities", QS ranks, STEM badges and
 * average graduate salaries as prototype copy. Universta has no ranking,
 * STEM-designation or salary data, so those badges and facts are omitted
 * rather than faked, and every count on the page is the real catalogue count.
 *
 * The same rule governs the filter rail. The template's facets map almost
 * one-to-one onto `/courses/filter-options`, so they are rendered from the API
 * response -- which also means a facet with no matching records simply does
 * not appear, instead of a control that looks live and filters nothing. The
 * career, duration-band and resource blocks have no backing entity at all and
 * are left out; the surrounding layout keeps its rhythm because the sections
 * that do have data occupy the same grid. */

export type CoursesReferenceProps = {
  courses: Course[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  subjects: Subject[];
  filterOptions: CourseFilterOptions;
  filters: Record<string, string>;
  /** Real link clusters; each is empty when the catalogue has no records. */
  universities: Array<{ name: string; slug: string }>;
  consultants: Array<{ name: string; slug: string }>;
  events: Array<{ name: string; slug: string; mode: string | null; startAt: string | null }>;
  heading: string;
  headingAccent: string;
  lede: string;
  ctaHeading: string;
  ctaBody: string;
};

const FAQS = [
  {
    q: 'How do I choose the right course to study abroad?',
    a: 'Balance four things: academic fit, affordability, admission chances and career outcomes. Start with your degree level and destination, narrow by tuition and scholarship availability, then shortlist three to five programmes and compare them side by side.',
  },
  {
    q: 'What is the difference between a course and a course offering?',
    a: 'A course is the programme itself — its subject, level and duration. An offering is that course as taught by a specific university in a specific country, with its own tuition, intakes and entry requirements. Filtering by destination shows you the offerings available there.',
  },
  {
    q: 'Can I filter courses by intake?',
    a: 'Yes. Each published offering records the intake window it belongs to, so the intake filter narrows results to programmes actually accepting students for that period.',
  },
  {
    q: 'Which English tests are accepted?',
    a: 'Requirements are set per programme. Use the English test filter to see only the courses that record an accepted score for your test.',
  },
  {
    q: 'How do I compare courses?',
    a: 'Tick “Compare” on up to three results. A tray appears at the bottom of the page and takes you to a side-by-side comparison of tuition, duration, intakes and study modes.',
  },
  {
    q: 'Do the listings include scholarship information?',
    a: 'Where a programme records a linked funding opportunity it is flagged on the card, and the scholarships filter narrows the list to those programmes. Full award details live on the scholarship record itself.',
  },
];

const WHY = [
  {
    ic: '🔍',
    h: 'Published records only',
    p: 'Every programme on this page comes from a published catalogue record. Nothing is placeholder content.',
  },
  {
    ic: '⚖️',
    h: 'Side-by-side comparison',
    p: 'Shortlist up to three courses and compare tuition, duration, intakes and study modes in one view.',
  },
  {
    ic: '🎯',
    h: 'Filters that actually filter',
    p: 'Every facet in the rail is backed by real data, so a result count of zero means zero matching programmes.',
  },
  {
    ic: '🌍',
    h: 'Destination context',
    p: 'Each destination page carries the country’s own intake calendar, requirements and cost guidance.',
  },
  {
    ic: '💬',
    h: 'Talk to a counsellor',
    p: 'Book a free session when you want a second opinion on a shortlist before you apply.',
  },
  {
    ic: '🔄',
    h: 'Kept current',
    p: 'Programme details, intakes and deadlines are maintained in one place and update across the site together.',
  },
];

const TOOLS = [
  { ic: '⚖️', h: 'Compare courses', p: 'Line up to three programmes side by side.', href: '/compare/courses' },
  { ic: '🏛️', h: 'Compare universities', p: 'Weigh institutions against each other.', href: '/compare/universities' },
  { ic: '🎓', h: 'Scholarship finder', p: 'Filter published funding by destination and level.', href: '/scholarships' },
  { ic: '💬', h: 'Free counselling', p: 'Book a session with an advisor.', href: '/counselling' },
];

/** Dimensions the courses endpoint ORs within, carried comma-joined in the URL. */
const MULTI_KEYS = [
  'level',
  'country',
  'subject',
  'subSubject',
  'studyMode',
  'intake',
  'englishTest',
] as const;

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
 * falls back to its first two letters, which is what makes a country tile say
 * "CA" instead of a lone "C". */
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

  function browseHref(next: Record<string, string>) {
    return `/courses?${new URLSearchParams(next)}#discovery`;
  }

  const facetGroups = useMemo(
    () =>
      [
        { key: 'level', label: 'Degree level', options: filterOptions.levels, open: true },
        { key: 'country', label: 'Destination', options: filterOptions.countries, open: true },
        { key: 'subject', label: 'Subject', options: filterOptions.subjects, open: true },
        {
          key: 'subSubject',
          label: 'Specialisation',
          options: filterOptions.subSubjects,
          open: true,
        },
        { key: 'studyMode', label: 'Study mode', options: filterOptions.studyModes, open: true },
        { key: 'intake', label: 'Intake', options: filterOptions.intakes, open: true },
        { key: 'englishTest', label: 'English test', options: filterOptions.englishTests, open: true },
      ].filter((group) => group.options.length > 0),
    [filterOptions],
  );

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

  const topSubjects = props.subjects.slice(0, 8);
  const topCountries = filterOptions.countries.slice(0, 6);
  const specialisations = filterOptions.subSubjects.slice(0, 8);

  return (
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/courses" aria-current="page">
            Courses
          </Link>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          {meta.total ? (
            <span className="hero-pill">
              <span className="dot" aria-hidden="true" /> <b>{formatNumber(meta.total)}</b>&nbsp;published
              programmes
              {filterOptions.countries.length ? (
                <>
                  {' '}
                  · <b>{filterOptions.countries.length}</b>&nbsp;destinations
                </>
              ) : null}
            </span>
          ) : null}
          <h1 style={{ marginTop: 16 }}>
            {props.heading}{' '}
            {props.headingAccent ? <span className="b">{props.headingAccent}</span> : null}
          </h1>
          <p className="lead">{props.lede}</p>

          <SearchCombobox
            label="Search courses"
            placeholder="Search courses, subjects or qualifications…"
            submitLabel="Find courses"
            endpoint="/api/courses/suggestions"
            emptyMessage="No courses found."
            value={query}
            onValueChange={setQuery}
            onSubmit={(term) => commit({ q: term.trim() || null })}
          />

          {(filterOptions.extras.length || filterOptions.intakes.length) > 0 ? (
            <div className="pop" style={{ marginTop: 18 }}>
              <b>Popular:</b>
              {/* Quick filters toggle a single parameter straight away, so their
                  pressed state is the URL rather than page-local memory. */}
              <button
                type="button"
                className={`chip${filters.scholarshipAvailable === 'true' ? ' on' : ''}`}
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
                className={`chip${filters.postStudyWorkAvailable === 'true' ? ' on' : ''}`}
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
              {filterOptions.intakes.slice(0, 3).map((intake) => (
                <Link key={intake.value} className="chip" href={browseHref({ intake: intake.value })}>
                  {intake.label} intake
                </Link>
              ))}
            </div>
          ) : null}

          <div className="hero-ctas">
            <a href="#discovery" className="btn btn-primary btn-lg">
              Browse courses
            </a>
            <Link href="/compare/courses" className="btn btn-outline btn-lg">
              Compare courses
            </Link>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>

          <div className="statgrid">
            <div className="stat">
              <b>{formatNumber(meta.total) || '—'}</b>
              <span>Programmes</span>
            </div>
            <div className="stat">
              <b>{filterOptions.subjects.length || '—'}</b>
              <span>Subjects</span>
            </div>
            <div className="stat">
              <b>{filterOptions.subSubjects.length || '—'}</b>
              <span>Specialisations</span>
            </div>
            <div className="stat">
              <b>{filterOptions.countries.length || '—'}</b>
              <span>Destinations</span>
            </div>
            <div className="stat">
              <b>{filterOptions.levels.length || '—'}</b>
              <span>Degree levels</span>
            </div>
            <div className="stat">
              <b>{filterOptions.studyModes.length || '—'}</b>
              <span>Study modes</span>
            </div>
          </div>
        </div>
      </section>

      {/* SEO INTRO */}
      <section className="wrap" style={{ padding: '44px 0 0' }}>
        <div className="prose">
          <p>
            Universta brings every published programme into one place so you can compare study abroad
            courses on the things that decide an application: qualification level, destination, tuition,
            study mode, intake window and English requirements. Filter down to the programmes you are
            actually eligible for, shortlist them, then compare them side by side before you apply.
          </p>
          <div className="takeaways">
            <h4>Key takeaways</h4>
            <ul>
              <li>Compare up to three courses side by side across tuition, duration, intakes and study modes.</li>
              <li>Every filter in the rail is backed by real catalogue data — nothing is decorative.</li>
              <li>Intake windows come from each destination’s own published calendar.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* BROWSE BY SUBJECT */}
      {topSubjects.length ? (
        <section className="sec wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Explore</span>
              <h2>Browse courses by subject</h2>
              <p>Every subject area currently published in the catalogue.</p>
            </div>
            <Link href="/subjects" className="link-more">
              All subjects →
            </Link>
          </div>
          <div className="grid g4">
            {topSubjects.map((subject) => (
              <Link key={subject.id} href={`/subjects/${subject.slug}`} className="card subj-card">
                <span className="subj-ic" aria-hidden="true">
                  {initials(subject.name)}
                </span>
                <h3>{subject.name}</h3>
                <div className="subj-meta">
                  {subject.publishedSubSubjectCount ? (
                    <span>
                      <b>{subject.publishedSubSubjectCount}</b> specialisations
                    </span>
                  ) : null}
                  {subject.availableCountryCount ? (
                    <span>
                      <b>{subject.availableCountryCount}</b> destinations
                    </span>
                  ) : null}
                </div>
                <div className="subj-foot">
                  <span className="cnt">
                    {formatNumber(subject.publishedCourseCount)} course
                    {subject.publishedCourseCount === 1 ? '' : 's'}
                  </span>
                  <span className="go">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* DISCOVERY: FILTERS + RESULTS */}
      <section className="sec wrap" id="discovery" style={{ paddingTop: 20 }}>
        <div className="sec-head left">
          <span className="eyebrow">Discover → filter → compare</span>
          <h2>All courses</h2>
          <p>Search, filter and shortlist programmes. Tick Compare on any course to line them up side by side.</p>
        </div>

        <div className="listing">
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
            className={`filters${drawerOpen ? ' open' : ''}`}
            aria-label="Filter courses"
            data-testid="course-filters"
          >
            <div className="fhead">
              <h3>Filters</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {activeCount ? (
                  <Link href="/courses#discovery" style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>
                    Clear all
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm filter-toggle"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close filters"
                  style={{ padding: '6px 10px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                applyDraft();
              }}
            >
            <div className="fscroll">
            {facetGroups.map((group) => (
              <details className="fgroup" key={group.key} open={group.open}>
                <summary>
                  {group.label} <span className="caret">▾</span>
                </summary>
                <div className="opts">
                  {group.options.slice(0, 12).map((option) => {
                    const checked = (draft[group.key] ?? []).includes(option.value);
                    return (
                      <label className="opt" key={option.value}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDraft(group.key, option.value)}
                        />
                        {option.label}{' '}
                        <span className="cnt">{formatNumber(option.count)}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            ))}

            {filterOptions.extras.length ? (
              <details className="fgroup" open>
                <summary>
                  Extras <span className="caret">▾</span>
                </summary>
                <div className="opts">
                  {filterOptions.extras.map((extra) => {
                    const checked = filters[extra.value] === 'true';
                    return (
                      <label className="opt" key={extra.value}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => commit({ [extra.value]: checked ? null : 'true' })}
                        />
                        {extra.label}{' '}
                        <span className="cnt">{formatNumber(extra.count)}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            ) : null}
            <details
              className="fgroup"
              open={Boolean(tuitionCurrency || tuitionRange.min || tuitionRange.max)}
            >
              <summary>
                Tuition fee <span className="caret">▾</span>
              </summary>
              <div className="opts">
                {tuitionCurrency ? (
                  <>
                    <p className="fhelp">Amounts in {tuitionCurrency}, per year.</p>
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
                          setTuitionRange((current) => ({ ...current, min: event.target.value }))
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
                          setTuitionRange((current) => ({ ...current, max: event.target.value }))
                        }
                      />
                    </label>
                  </>
                ) : (
                  <p className="fhelp">
                    {/* Tuition is stored per destination in that destination's own
                        currency, so a range across several is meaningless. */}
                    Select exactly one destination to filter by tuition in a single currency.
                  </p>
                )}
              </div>
            </details>
            </div>

            <div className="ffoot">
              <button className="btn btn-primary btn-block" type="submit">
                Apply filters
              </button>
            </div>
            </form>
          </aside>

          <div>
            <div className="main-head">
              <button
                type="button"
                className="btn btn-ghost btn-sm filter-toggle"
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls="course-filter-panel"
              >
                <span aria-hidden="true">☰ </span>
                Filters{activeCount ? ` (${activeCount})` : ''}
              </button>
              <p className="count" data-testid="course-count">
                {formatNumber(meta.total)} course{meta.total === 1 ? '' : 's'}{' '}
                <span>{activeCount ? 'match your filters' : 'published'}</span>
              </p>
              {filterOptions.sorts.length > 1 ? (
                <div className="sortsel">
                  <label htmlFor="course-sort">Sort by</label>
                  <select
                    id="course-sort"
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
                </div>
              ) : null}
            </div>

            {courses.length === 0 ? (
              <div className="cref-empty" data-testid="course-empty">
                <h3>No courses match these filters</h3>
                <p>Try removing a filter, or browse by subject or destination below.</p>
                <Link className="btn btn-primary" href="/courses#discovery">
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="slist course-list">
                {courses.map((course) => {
                  const dur = duration(course);
                  const fee = tuition(course);
                  const intake = nextIntake(course);
                  const checked = compare.some((item) => item.slug === course.slug);
                  return (
                    <article className="course" key={course.id}>
                      <div className="course-top">
                        <span className="uni-logo" aria-hidden="true">
                          {initials(course.subject.name)}
                        </span>
                        <div className="course-head">
                          <div className="course-badges">
                            <span className="badge badge-lvl">🎓 {course.courseLevel.name}</span>
                            {course.scholarshipAvailable ? (
                              <span className="badge badge-sch">★ Scholarships</span>
                            ) : null}
                            {course.studyModes.slice(0, 1).map((mode) => (
                              <span className="badge badge-mode" key={mode.id}>
                                {mode.name}
                              </span>
                            ))}
                          </div>
                          <h3>
                            <Link href={`/courses/${course.slug}`}>{course.name}</Link>
                          </h3>
                          <div className="uni">
                            <span className="cc">{course.subject.name}</span>
                            {course.subSubject ? <span>· {course.subSubject.name}</span> : null}
                            {course.selectedCountry ? <span>· {course.selectedCountry.name}</span> : null}
                          </div>
                        </div>
                      </div>

                      {dur || fee || intake || course.availableCountryCount ? (
                        <div className="course-facts">
                          {dur ? (
                            <div className="fact">
                              <div className="k">Duration</div>
                              <div className="v">{dur}</div>
                            </div>
                          ) : null}
                          {fee ? (
                            <div className="fact">
                              <div className="k">Tuition</div>
                              <div className="v">{fee}</div>
                            </div>
                          ) : null}
                          {intake ? (
                            <div className="fact">
                              <div className="k">Next intake</div>
                              <div className="v">{intake}</div>
                            </div>
                          ) : null}
                          {course.availableCountryCount ? (
                            <div className="fact">
                              <div className="k">Available in</div>
                              <div className="v">
                                {course.availableCountryCount} destination
                                {course.availableCountryCount === 1 ? '' : 's'}
                              </div>
                            </div>
                          ) : null}
                          {course.qualificationName &&
                          course.qualificationName !== course.name ? (
                            <div className="fact">
                              <div className="k">Qualification</div>
                              <div className="v">{course.qualificationName}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="course-foot">
                        <label className="cmp-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && compare.length >= 3}
                            onChange={() => toggleCompare(course)}
                          />
                          Compare
                        </label>
                        <span className="spacer" />
                        <Link href={`/courses/${course.slug}`} className="btn btn-primary btn-sm">
                          View course →
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {meta.totalPages > 1 || meta.page > 1 ? (
              <nav className="pager" aria-label="Course results pagination">
                <button
                  type="button"
                  aria-label="Previous results page"
                  disabled={meta.page <= 1}
                  onClick={() => router.push(pageHref(meta.page - 1))}
                >
                  ‹
                </button>
                {Array.from({ length: meta.totalPages }, (_, index) => index + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === meta.totalPages ||
                      Math.abs(page - meta.page) <= 1,
                  )
                  .map((page, index, list) => (
                    <span key={page} style={{ display: 'contents' }}>
                      {index > 0 && page - list[index - 1] > 1 ? <span>…</span> : null}
                      {page === meta.page ? (
                        <span className="cur">{page}</span>
                      ) : (
                        <Link href={pageHref(page)}>{page}</Link>
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
      </section>

      {/* BROWSE BY DEGREE LEVEL */}
      {filterOptions.levels.length ? (
        <section className="sec wrap">
          <div className="panel">
            <div className="sec-head left">
              <span className="eyebrow">By qualification</span>
              <h2>Browse courses by degree level</h2>
            </div>
            <div className="grid g4">
              {filterOptions.levels.map((level) => (
                <Link key={level.value} href={browseHref({ level: level.value })} className="card mini-card">
                  <span className="mini-ic" aria-hidden="true">
                    {initials(level.label)}
                  </span>
                  <div>
                    <h3>{level.label}</h3>
                    <div className="mc-sub">
                      {formatNumber(level.count)} course{level.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* BROWSE BY DESTINATION */}
      {topCountries.length ? (
        <section className="sec wrap">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">By destination</span>
              <h2>Browse courses by study destination</h2>
              <p>Every destination with published course offerings.</p>
            </div>
            <Link href="/countries" className="link-more">
              All destinations →
            </Link>
          </div>
          <div className="grid g3">
            {topCountries.map((country) => (
              <Link key={country.value} href={browseHref({ country: country.value })} className="card dest-card">
                <div className="dest-top">
                  <span className="cc-tile" aria-hidden="true">
                    {initials(country.label)}
                  </span>
                  <div>
                    <h3>{country.label}</h3>
                    <div className="unis">
                      {formatNumber(country.count)} course{country.count === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                {country.currencyCode ? (
                  <div className="dest-tags">
                    <span className="pill-mini">Tuition in {country.currencyCode}</span>
                  </div>
                ) : null}
                <div className="dest-foot">
                  <span className="cnt">Browse courses</span>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* SPECIALISATIONS */}
      {specialisations.length ? (
        <section className="sec wrap">
          <div className="panel">
            <div className="sec-head left">
              <span className="eyebrow">Fields of study</span>
              <h2>Explore by specialisation</h2>
            </div>
            <div className="grid g4">
              {specialisations.map((item) => (
                <Link
                  key={item.value}
                  href={browseHref({ subject: item.subject.slug, subSubject: item.value })}
                  className="card mini-card"
                >
                  <span className="mini-ic" aria-hidden="true">
                    {initials(item.label)}
                  </span>
                  <div>
                    <h3>{item.label}</h3>
                    <div className="mc-sub">{item.subject.name}</div>
                  </div>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* STUDY MODE + INTAKE */}
      {filterOptions.studyModes.length || filterOptions.intakes.length ? (
        <section className="sec wrap">
          <div className="grid g2" style={{ alignItems: 'start', gap: 26 }}>
            {filterOptions.studyModes.length ? (
              <div>
                <div className="sec-head left">
                  <span className="eyebrow">Format</span>
                  <h2 style={{ fontSize: 26 }}>Courses by study mode</h2>
                </div>
                <div className="grid g2">
                  {filterOptions.studyModes.map((mode) => (
                    <Link
                      key={mode.value}
                      href={browseHref({ studyMode: mode.value })}
                      className="card mini-card"
                    >
                      <div>
                        <h3>{mode.label}</h3>
                        <div className="mc-sub">
                          {formatNumber(mode.count)} course{mode.count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            {filterOptions.intakes.length ? (
              <div>
                <div className="sec-head left">
                  <span className="eyebrow">Timing</span>
                  <h2 style={{ fontSize: 26 }}>Courses by intake</h2>
                </div>
                <div className="grid g2">
                  {filterOptions.intakes.slice(0, 6).map((intake) => (
                    <Link
                      key={intake.value}
                      href={browseHref({ intake: intake.value })}
                      className="card mini-card"
                    >
                      <div>
                        <h3>{intake.label}</h3>
                        <div className="mc-sub">
                          {intakeRange({
                            startMonth: intake.startMonth,
                            endMonth: intake.endMonth,
                            shortLabel: intake.label,
                          })}
                        </div>
                      </div>
                      <span className="go" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* WHY UNIVERSTA */}
      <section className="sec wrap">
        <div className="panel">
          <div className="sec-head">
            <span className="eyebrow">Why Universta</span>
            <h2>Everything you need to choose with confidence</h2>
          </div>
          <div className="grid g3">
            {WHY.map((item) => (
              <div className="card benefit" key={item.h}>
                <span className="benefit-ic" aria-hidden="true">
                  {item.ic}
                </span>
                <h3>{item.h}</h3>
                <p>{item.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section className="sec wrap">
        <div className="sec-head left">
          <span className="eyebrow">Free tools</span>
          <h2>Study abroad tools</h2>
          <p>Plan every step — from shortlisting to comparing to talking it through.</p>
        </div>
        <div className="grid g4">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="card tool">
              <span className="tool-ic" aria-hidden="true">
                {tool.ic}
              </span>
              <h3>{tool.h}</h3>
              <p>{tool.p}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* EVENTS */}
      {props.events.length ? (
        <section className="sec wrap">
          <div className="panel">
            <div className="sec-head left row-between">
              <div>
                <span className="eyebrow">Live &amp; virtual</span>
                <h2>Upcoming events</h2>
              </div>
              <Link href="/events" className="link-more">
                All events →
              </Link>
            </div>
            <div className="grid g4">
              {props.events.map((event) => (
                <Link key={event.slug} href={`/events/${event.slug}`} className="card event">
                  {event.mode ? <span className="event-type">{event.mode}</span> : null}
                  <h3>{event.name}</h3>
                  {event.startAt ? (
                    <div className="when">
                      {new Intl.DateTimeFormat('en-GB', {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(event.startAt))}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* SEO EXPANDABLE */}
      <section className="wrap" style={{ padding: '24px 0 48px' }}>
        <div className="prose">
          <h3>How to choose the right study abroad course</h3>
          <p>
            The best programme balances academic fit, affordability, admission chances and career
            outcomes. Start by filtering on your target degree level and destination, then narrow by
            study mode and scholarship availability. Shortlist three courses and use the compare tray
            to weigh tuition, duration and intakes against each other.
          </p>
          <details className="readmore">
            <summary>Read more about course selection</summary>
            <div style={{ marginTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>Popular course and destination combinations</h3>
              <p>
                {topSubjects.slice(0, 4).map((subject, index) => (
                  <span key={subject.id}>
                    {index > 0 ? ', ' : ''}
                    <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
                  </span>
                ))}
                {topSubjects.length && topCountries.length ? ' and destinations such as ' : null}
                {topCountries.slice(0, 4).map((country, index) => (
                  <span key={country.value}>
                    {index > 0 ? ', ' : ''}
                    <Link href={`/countries/${country.value}`}>{country.label}</Link>
                  </span>
                ))}
                {topSubjects.length || topCountries.length
                  ? ' each open their own filterable listing.'
                  : 'Browse the filters above to open a filterable listing.'}
              </p>
              <h3>English language requirements</h3>
              <p>
                Requirements are recorded per programme. Filter by the test you have taken to see only
                the courses that publish an accepted score for it.
              </p>
            </div>
          </details>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec wrap" id="faq">
        <div className="sec-head">
          <span className="eyebrow">Answers</span>
          <h2>Frequently asked questions</h2>
        </div>
        <div className="faq">
          {FAQS.map((item, index) => (
            <details className="qa" key={item.q} open={index === 0}>
              <summary>
                {item.q} <span className="plus">+</span>
              </summary>
              <p className="ans">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* INTERNAL LINK CLUSTERS */}
      {props.universities.length || topCountries.length || props.consultants.length ? (
        <section className="sec wrap">
          <div className="panel">
            <div className="link-cols">
              {props.universities.length ? (
                <div className="link-col">
                  <h3>Explore universities</h3>
                  <ul>
                    {props.universities.slice(0, 8).map((item) => (
                      <li key={item.slug}>
                        <Link href={`/universities/${item.slug}`}>→ {item.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {topCountries.length ? (
                <div className="link-col">
                  <h3>Explore destinations</h3>
                  <ul>
                    {topCountries.map((item) => (
                      <li key={item.value}>
                        <Link href={`/countries/${item.value}`}>→ Study in {item.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {props.consultants.length ? (
                <div className="link-col">
                  <h3>Find a consultant</h3>
                  <ul>
                    {props.consultants.slice(0, 8).map((item) => (
                      <li key={item.slug}>
                        <Link href={`/study-abroad-consultants/${item.slug}`}>→ {item.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* FINAL CTA */}
      <section className="sec wrap">
        <div className="final-cta">
          <h2>{props.ctaHeading}</h2>
          <p>{props.ctaBody}</p>
          <div className="hero-ctas">
            <a href="#discovery" className="btn btn-secondary btn-lg">
              Browse courses
            </a>
            <Link href="/compare/courses" className="btn btn-outline btn-lg">
              Compare courses
            </Link>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
      </section>

      {/* COMPARE TRAY */}
      {compare.length ? (
        <div className="tray" data-testid="course-compare-tray">
          <div className="tray-inner">
            <span className="tt">
              <span className="badge-n">{compare.length}</span> Compare
            </span>
            <div className="tray-slots">
              {compare.map((item) => (
                <span className="tray-slot" key={item.slug}>
                  <span className="nm">{item.name}</span>
                  <button
                    type="button"
                    className="x"
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
            <div className="tray-actions">
              <button type="button" className="btn-clear" onClick={() => setCompare([])}>
                Clear
              </button>
              <Link href={compareHref} className="btn btn-primary btn-sm">
                Compare {compare.length}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

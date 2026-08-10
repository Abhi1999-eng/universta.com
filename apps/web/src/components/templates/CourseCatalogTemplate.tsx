'use client';

/* API-selected media can come from approved external asset hosts. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { StatsPill } from '@/components/StatsPill';
import type { ResolvedStatsPill } from '@/lib/stats-pill';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { counsellingHref } from '@/lib/counselling-link';
import { intakeRange } from '@/lib/intake-range';
import type {
  Course,
  CourseFilterOption,
  CourseFilterOptions,
  PageMeta,
  Subject,
} from '@/lib/catalog';
import { CatalogFooter, CatalogHeader } from './ApprovedTemplatePages';

type CourseIconName =
  | 'arrow'
  | 'book'
  | 'calendar'
  | 'cap'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'globe'
  | 'money'
  | 'search'
  | 'star';

const iconPaths: Record<CourseIconName, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  calendar: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
  cap: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5',
  chevron: 'm6 9 6 6 6-6',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
  close: 'M18 6 6 18M6 6l12 12',
  globe:
    'M2 12h20M12 2a15 15 0 1 1 0 20M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20',
  money: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  search: 'm21 21-4.3-4.3M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14',
  star: 'm12 2 3 6.5 7 .6-5.3 4.6 1.6 6.8L12 17l-6.3 3.5 1.6-6.8L2 9.1l7-.6z',
};

function CourseIcon({
  name,
  size = 18,
}: {
  name: CourseIconName;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

type CourseSuggestion = {
  id: string;
  name: string;
  slug: string;
  subject: { name: string };
};

type CourseMultiFilterKey =
  | 'level'
  | 'country'
  | 'subject'
  | 'subSubject'
  | 'studyMode'
  | 'intake'
  | 'englishTest';

type CourseBooleanFilterKey =
  | 'scholarshipAvailable'
  | 'postStudyWorkAvailable';

type CourseFilterDraft = Record<CourseMultiFilterKey, string[]> &
  Record<CourseBooleanFilterKey, boolean> & {
    minTuition: string;
    maxTuition: string;
  };

const multiFilterKeys: CourseMultiFilterKey[] = [
  'level',
  'country',
  'subject',
  'subSubject',
  'studyMode',
  'intake',
  'englishTest',
];

const booleanFilterKeys: CourseBooleanFilterKey[] = [
  'scholarshipAvailable',
  'postStudyWorkAvailable',
];

const courseQueryKeys = new Set([
  'q',
  ...multiFilterKeys,
  ...booleanFilterKeys,
  'minTuition',
  'maxTuition',
  'sort',
  'page',
  'pageSize',
]);

function csvValues(value: string | undefined) {
  return value
    ? [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function canonicalCsv(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)).join(',');
}

function queryRecord(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}

function draftFromFilters(filters: Record<string, string>): CourseFilterDraft {
  return {
    level: csvValues(filters.level),
    country: csvValues(filters.country),
    subject: csvValues(filters.subject),
    subSubject: csvValues(filters.subSubject),
    studyMode: csvValues(filters.studyMode),
    intake: csvValues(filters.intake),
    englishTest: csvValues(filters.englishTest),
    scholarshipAvailable: filters.scholarshipAvailable === 'true',
    postStudyWorkAvailable: filters.postStudyWorkAvailable === 'true',
    minTuition: filters.minTuition ?? '',
    maxTuition: filters.maxTuition ?? '',
  };
}

function CourseTemplateCard({
  course,
  countryFilter,
}: {
  course: Course;
  countryFilter?: string;
}) {
  const tuition = course.selectedTuition;
  const duration = course.duration.min
    ? `${course.duration.min}${
        course.duration.max && course.duration.max !== course.duration.min
          ? `–${course.duration.max}`
          : ''
      } ${course.duration.unit ?? ''}`
    : 'Varies';
  const intake = intakeRange(course.selectedIntakes[0]?.intake ?? {});
  const courseHref = `/courses/${course.slug}${
    countryFilter ? `?country=${encodeURIComponent(countryFilter)}` : ''
  }`;

  return (
    <article className="course">
      <div className="course-top">
        <div className="uni-logo">
          {course.featuredMedia ? (
            <img
              src={course.featuredMedia.url}
              alt={course.featuredMedia.alt ?? course.name}
            />
          ) : (
            course.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="course-head">
          <div className="course-badges">
            <span className="badge badge-lvl">
              <CourseIcon name="cap" size={12} />
              {course.courseLevel.name}
            </span>
            {course.scholarshipAvailable ? (
              <span className="badge badge-sch">
                <CourseIcon name="star" size={12} />
                Scholarships
              </span>
            ) : null}
          </div>
          <h3>
            <Link href={courseHref}>{course.name}</Link>
          </h3>
          <div className="uni">
            {course.subject.name}
            {course.selectedCountry ? ` · ${course.selectedCountry.name}` : ''}
          </div>
        </div>
      </div>
      <div className="course-facts">
        <div className="fact">
          <div className="k">
            <CourseIcon name="clock" size={13} />
            Duration
          </div>
          <div className="v">{duration}</div>
        </div>
        <div className="fact">
          <div className="k">
            <CourseIcon name="money" size={13} />
            Tuition
          </div>
          <div className="v">
            {tuition?.min
              ? `${tuition.currencyCode ?? ''} ${Number(tuition.min).toLocaleString('en-US')}`
              : 'Select a destination'}
          </div>
        </div>
        <div className="fact">
          <div className="k">
            <CourseIcon name="calendar" size={13} />
            Next intake
          </div>
          <div className="v">{intake}</div>
        </div>
        <div className="fact">
          <div className="k">
            <CourseIcon name="globe" size={13} />
            Countries
          </div>
          <div className="v">{course.availableCountryCount}</div>
        </div>
      </div>
      <div className="course-foot">
        <div className="spacer" />
        <Link href={courseHref} className="btn btn-primary btn-sm">
          View course <CourseIcon name="arrow" size={15} />
        </Link>
      </div>
    </article>
  );
}

function MiniLinkGrid({
  items,
}: {
  items: Array<{ label: string; href: string; detail?: string }>;
}) {
  return (
    <div className="grid g4">
      {items.map((item) => (
        <Link className="card mini-card" href={item.href} key={item.href}>
          <span className="mini-ic">
            <CourseIcon name="book" />
          </span>
          <span>
            <h3>{item.label}</h3>
            {item.detail ? <span className="cc-sub">{item.detail}</span> : null}
          </span>
          <span className="go">
            <CourseIcon name="arrow" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ApprovedCoursesListing({
  courses,
  meta,
  subjects,
  filterOptions,
  filters: initialFilters,
  pill,
}: {
  courses: Course[];
  meta: PageMeta;
  subjects: Subject[];
  filterOptions: CourseFilterOptions;
  filters: Record<string, string>;
  pill?: ResolvedStatsPill | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialFilters.q ?? '');
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [interactionsReady, setInteractionsReady] = useState(false);
  const [filterDraft, setFilterDraft] = useState<CourseFilterDraft>(
    draftFromFilters(initialFilters),
  );
  const searchLocationRef = useRef(searchParams.toString());
  const currentFilters = useMemo(
    () => queryRecord(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const submittedQuery = currentFilters.q ?? '';

  const optionGroups = (
    [
      { key: 'level', label: 'Degree level', options: filterOptions.levels },
      {
        key: 'country',
        label: 'Destination',
        options: filterOptions.countries,
      },
      { key: 'subject', label: 'Subject', options: filterOptions.subjects },
      {
        key: 'subSubject',
        label: 'Specialization',
        options: filterOptions.subSubjects,
      },
      {
        key: 'studyMode',
        label: 'Study mode',
        options: filterOptions.studyModes,
      },
      { key: 'intake', label: 'Intake', options: filterOptions.intakes },
      {
        key: 'englishTest',
        label: 'English test',
        options: filterOptions.englishTests,
      },
    ] satisfies Array<{
      key: CourseMultiFilterKey;
      label: string;
      options: CourseFilterOption[];
    }>
  ).filter((group) => group.options.length > 0);

  const selectedCountries = csvValues(currentFilters.country);
  const selectedCountryForDetail =
    selectedCountries.length === 1 ? selectedCountries[0] : undefined;
  const januaryIntake = filterOptions.intakes.find(
    (option) => option.startMonth === 1 || option.value === 'january',
  );
  const scholarshipExtra = filterOptions.extras.find(
    (option) => option.value === 'scholarshipAvailable',
  );
  const postStudyWorkExtra = filterOptions.extras.find(
    (option) => option.value === 'postStudyWorkAvailable',
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setInteractionsReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const nextLocation = searchParams.toString();
    if (searchLocationRef.current === nextLocation) return;
    searchLocationRef.current = nextLocation;
    const timer = window.setTimeout(() => {
      setQuery(submittedQuery);
      setFilterDraft(draftFromFilters(currentFilters));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentFilters, searchParams, submittedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2 || query.trim() === submittedQuery) {
        setSuggestions([]);
        setSuggestionsOpen(false);
        return;
      }
      void fetch(`/api/courses/suggestions?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ data?: CourseSuggestion[] }>)
        .then((body) => {
          setSuggestions(body.data ?? []);
          setActiveSuggestion(-1);
          setSuggestionsOpen(true);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string }).name !== 'AbortError') {
            setSuggestions([]);
            setSuggestionsOpen(false);
          }
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, submittedQuery]);

  useEffect(() => {
    const closeSuggestions = (event: MouseEvent) => {
      if (!searchAreaRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeSuggestions);
    return () => document.removeEventListener('mousedown', closeSuggestions);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [filtersOpen]);

  function navigate(
    next: Record<string, string | undefined>,
    scroll = false,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...params.keys()]) {
      if (!courseQueryKeys.has(key)) params.delete(key);
    }
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`, {
      scroll,
    });
  }

  function submitSearch(value: string) {
    const next = value.trim();
    setQuery(next);
    setSuggestionsOpen(false);
    navigate({ q: next || undefined, page: undefined });
  }

  function selectCourseSuggestion(suggestion: CourseSuggestion) {
    setQuery(suggestion.name);
    setSuggestionsOpen(false);
    navigate({ q: suggestion.name, page: undefined });
  }

  function handleCourseSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' && suggestionsOpen && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1,
      );
      return;
    }
    if (event.key === 'ArrowUp' && suggestionsOpen && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (
        suggestionsOpen &&
        activeSuggestion >= 0 &&
        suggestions[activeSuggestion]
      ) {
        selectCourseSuggestion(suggestions[activeSuggestion]);
      } else {
        submitSearch(query);
      }
    }
  }

  function toggleDraftValue(key: CourseMultiFilterKey, value: string) {
    setFilterDraft((current) => {
      const selected = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value];
      const next = { ...current, [key]: selected };
      if (key === 'subject') {
        const allowedSubSubjects = new Set(
          filterOptions.subSubjects
            .filter(
              (option) =>
                !selected.length || selected.includes(option.subject.slug),
            )
            .map((option) => option.value),
        );
        next.subSubject = current.subSubject.filter((item) =>
          allowedSubSubjects.has(item),
        );
      }
      if (key === 'country' && selected.length !== 1) {
        next.minTuition = '';
        next.maxTuition = '';
      }
      return next;
    });
  }

  function applyFilters(formData: FormData) {
    const next: Record<string, string | undefined> = {
      page: undefined,
      minTuition: String(formData.get('minTuition') ?? '') || undefined,
      maxTuition: String(formData.get('maxTuition') ?? '') || undefined,
    };
    for (const key of multiFilterKeys) {
      next[key] =
        canonicalCsv(formData.getAll(key).map((value) => String(value))) ||
        undefined;
    }
    for (const key of booleanFilterKeys) {
      next[key] = formData.get(key) === 'true' ? 'true' : undefined;
    }
    navigate(next);
    setFiltersOpen(false);
  }

  function toggleQuickFilter(
    key: CourseMultiFilterKey | CourseBooleanFilterKey,
    value = 'true',
  ) {
    if (multiFilterKeys.includes(key as CourseMultiFilterKey)) {
      const multiKey = key as CourseMultiFilterKey;
      const current = csvValues(currentFilters[multiKey]);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      navigate({
        [multiKey]: canonicalCsv(next) || undefined,
        page: undefined,
      });
      return;
    }
    navigate({
      [key]: currentFilters[key] === 'true' ? undefined : 'true',
      page: undefined,
    });
  }

  function clearCourseFilters() {
    setQuery('');
    setSuggestionsOpen(false);
    setFiltersOpen(false);
    router.push(pathname, { scroll: false });
  }

  const activeFilterCount =
    multiFilterKeys.filter((key) => csvValues(currentFilters[key]).length > 0)
      .length +
    booleanFilterKeys.filter((key) => currentFilters[key] === 'true').length +
    (currentFilters.minTuition || currentFilters.maxTuition ? 1 : 0);

  return (
    <main className="visual-courses-page">
      <CatalogHeader active="courses" />
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="sep">/</li>
            <li aria-current="page">Courses</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-inner">
          <StatsPill pill={pill} />
          <h1>
            {/* Explicit space: a bare <br /> gives the visual line break but
                leaves textContent as "Courseto", which is what screen readers
                announce and crawlers index. */}
            Find the Perfect Course{' '}
            <br />
            to <span>Study Abroad</span>
          </h1>
          <p className="lede">
            Explore published programs and compare their real duration,
            tuition, intakes, study modes, and destination availability.
          </p>
          <div className="course-search-area" ref={searchAreaRef}>
            <form
              className="search-shell"
              action="/courses"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch(query);
              }}
            >
              <div className="search-box">
                <CourseIcon name="search" />
                <input
                  name="q"
                  role="combobox"
                  placeholder="Search courses, subjects or qualifications..."
                  aria-label="Search courses"
                  aria-busy={!interactionsReady}
                  aria-expanded={suggestionsOpen}
                  aria-controls="course-suggestions"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    suggestionsOpen &&
                    activeSuggestion >= 0 &&
                    suggestions[activeSuggestion]
                      ? `course-suggestion-${suggestions[activeSuggestion].id}`
                      : undefined
                  }
                  value={query}
                  readOnly={!interactionsReady}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleCourseSearchKeyDown}
                />
                <button type="submit" className="btn btn-primary">
                  Find Courses
                </button>
              </div>
            </form>
            {suggestionsOpen ? (
              <ul
                className="suggest open"
                id="course-suggestions"
                role="listbox"
              >
                {suggestions.length ? (
                  suggestions.map((suggestion, index) => (
                    <li
                      id={`course-suggestion-${suggestion.id}`}
                      className={`suggest-item${
                        index === activeSuggestion ? ' hl' : ''
                      }`}
                      role="option"
                      aria-selected={index === activeSuggestion}
                      key={suggestion.id}
                    >
                      <button
                        type="button"
                        onMouseEnter={() => setActiveSuggestion(index)}
                        onClick={() => selectCourseSuggestion(suggestion)}
                      >
                        <span className="sic">
                          <CourseIcon name="book" />
                        </span>
                        <span>
                          <span className="st">{suggestion.name}</span>
                          <span className="sd">
                            {suggestion.subject.name}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="suggest-group-label" role="status">
                    No courses found.
                  </li>
                )}
              </ul>
            ) : null}
          </div>
          <div className="chips" aria-label="Quick course filters">
            {scholarshipExtra ? (
              <button
                type="button"
                className={`chip${
                  currentFilters.scholarshipAvailable === 'true' ? ' on' : ''
                }`}
                aria-pressed={
                  currentFilters.scholarshipAvailable === 'true'
                }
                onClick={() => toggleQuickFilter('scholarshipAvailable')}
              >
                <CourseIcon name="star" size={14} />
                Scholarships
              </button>
            ) : null}
            {januaryIntake ? (
              <button
                type="button"
                className={`chip${
                  csvValues(currentFilters.intake).includes(januaryIntake.value)
                    ? ' on'
                    : ''
                }`}
                aria-pressed={csvValues(currentFilters.intake).includes(
                  januaryIntake.value,
                )}
                onClick={() =>
                  toggleQuickFilter('intake', januaryIntake.value)
                }
              >
                <CourseIcon name="calendar" size={14} />
                {januaryIntake.label} intake
              </button>
            ) : null}
            {postStudyWorkExtra ? (
              <button
                type="button"
                className={`chip${
                  currentFilters.postStudyWorkAvailable === 'true' ? ' on' : ''
                }`}
                aria-pressed={
                  currentFilters.postStudyWorkAvailable === 'true'
                }
                onClick={() => toggleQuickFilter('postStudyWorkAvailable')}
              >
                <CourseIcon name="globe" size={14} />
                Verified post-study work
              </button>
            ) : null}
          </div>
          <div className="hero-ctas">
            <a href="#discovery" className="btn btn-primary">
              Find Courses
            </a>
            <Link href="/subjects" className="btn btn-outline">
              Browse Subjects
            </Link>
            <Link
              href={counsellingHref({
                source: 'course',
                from: '/courses',
              })}
              className="btn btn-secondary"
            >
              Get free counselling
            </Link>
          </div>
        </div>
      </section>

      <section className="wrap academic-intro">
        <p>
          Start with a subject, qualification, destination, or intake. Every
          visible control below is connected to published catalog data and can
          be shared or revisited from its URL.
        </p>
      </section>

      <section className="wrap" style={{ paddingBottom: 8 }}>
        <div className="stats-grid">
          <div className="stat">
            <div className="num">{meta.total}</div>
            <div className="lbl">Matching programs</div>
          </div>
          <div className="stat">
            <div className="num">{filterOptions.subjects.length}</div>
            <div className="lbl">Subjects</div>
          </div>
          <div className="stat">
            <div className="num">{filterOptions.countries.length}</div>
            <div className="lbl">Destinations</div>
          </div>
          <div className="stat">
            <div className="num">{filterOptions.levels.length}</div>
            <div className="lbl">Degree levels</div>
          </div>
          <div className="stat">
            <div className="num">{filterOptions.studyModes.length}</div>
            <div className="lbl">Study modes</div>
          </div>
          <div className="stat">
            <div className="num">{filterOptions.intakes.length}</div>
            <div className="lbl">Published intakes</div>
          </div>
        </div>
      </section>

      <section className="section wrap" id="subjects">
        <div className="section-head row-between">
          <div>
            <span className="eyebrow">Explore</span>
            <h2>Browse courses by popular subjects</h2>
          </div>
          <Link href="/subjects" className="link-more">
            All subjects <CourseIcon name="arrow" size={16} />
          </Link>
        </div>
        <MiniLinkGrid
          items={subjects.slice(0, 8).map((subject) => ({
            label: subject.name,
            href: `/courses?subject=${encodeURIComponent(subject.slug)}`,
            detail: `${subject.publishedCourseCount} programs`,
          }))}
        />
      </section>

      <section
        className="section wrap"
        id="discovery"
        style={{ paddingTop: 20 }}
      >
        <div className="section-head row-between">
          <div>
            <span className="eyebrow">Discover → Filter</span>
            <h2>Explore published courses</h2>
            <p className="sub">
              Search, combine filters, and sort the real catalog.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline filter-toggle-mobile"
            aria-expanded={filtersOpen}
            aria-controls="course-filter-panel"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
        </div>
        <button
          type="button"
          className={`scrim${filtersOpen ? ' show' : ''}`}
          aria-label="Close course filters"
          tabIndex={filtersOpen ? 0 : -1}
          onClick={() => setFiltersOpen(false)}
        />
        <div className="discovery">
          <aside
            className={`filters${filtersOpen ? ' open' : ''}`}
            id="course-filter-panel"
            aria-label="Course filters"
          >
            <div className="filters-head">
              <h3>
                <CourseIcon name="search" />
                Filters
              </h3>
              <span className="course-filter-head-actions">
                <button
                  type="button"
                  className="clear"
                  onClick={clearCourseFilters}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="course-filter-close"
                  aria-label="Close course filters"
                  onClick={() => setFiltersOpen(false)}
                >
                  <CourseIcon name="close" />
                </button>
              </span>
            </div>
            <div className="filters-body">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  applyFilters(new FormData(event.currentTarget));
                }}
              >
                {optionGroups.map((group) => (
                  <div className="fgroup open" key={group.key}>
                    <div className="fgroup-btn">
                      {group.label}
                      <CourseIcon name="chevron" size={16} />
                    </div>
                    <div className="fgroup-panel">
                      {group.options.map((option) => (
                        <label className="fopt" key={option.value}>
                          <input
                            type="checkbox"
                            name={group.key}
                            value={option.value}
                            checked={filterDraft[group.key].includes(
                              option.value,
                            )}
                            onChange={() =>
                              toggleDraftValue(group.key, option.value)
                            }
                          />
                          <span>{option.label}</span>
                          <span className="cnt">{option.count}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {filterOptions.extras.length ? (
                  <div className="fgroup open">
                    <div className="fgroup-btn">Additional options</div>
                    <div className="fgroup-panel">
                      {filterOptions.extras.map((option) => {
                        const key = option.value as CourseBooleanFilterKey;
                        return (
                          <label className="fopt" key={key}>
                            <input
                              type="checkbox"
                              name={key}
                              value="true"
                              checked={filterDraft[key]}
                              onChange={(event) =>
                                setFilterDraft((current) => ({
                                  ...current,
                                  [key]: event.target.checked,
                                }))
                              }
                            />
                            <span>{option.label}</span>
                            <span className="cnt">{option.count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="fgroup open">
                  <div className="fgroup-btn">Tuition range</div>
                  <div className="fgroup-panel">
                    {filterOptions.tuition.enabled ? (
                      <>
                        <p className="course-filter-help">
                          Amounts in{' '}
                          <b>{filterOptions.tuition.currencyCode ?? 'the selected currency'}</b>{' '}
                          for the selected destination.
                        </p>
                        <div className="tuition-fields">
                          <label>
                            <span>Minimum</span>
                            <input
                              name="minTuition"
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={filterDraft.minTuition}
                              onChange={(event) =>
                                setFilterDraft((current) => ({
                                  ...current,
                                  minTuition: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            <span>Maximum</span>
                            <input
                              name="maxTuition"
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              value={filterDraft.maxTuition}
                              onChange={(event) =>
                                setFilterDraft((current) => ({
                                  ...current,
                                  maxTuition: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <p className="course-filter-help">
                        Select exactly one destination and apply it to compare
                        tuition in a single currency.
                      </p>
                    )}
                  </div>
                </div>

                <div className="filters-foot">
                  <button className="btn btn-primary btn-sm" type="submit">
                    Apply filters
                  </button>
                </div>
              </form>
            </div>
          </aside>

          <div>
            <div className="results-bar">
              <div className="results-count" role="status">
                <b>{meta.total}</b> courses match your search
                {meta.totalPages > 1
                  ? ` · page ${meta.page} of ${meta.totalPages}`
                  : ''}
              </div>
              <div className="sort-wrap">
                <label htmlFor="course-sort">Sort by</label>
                <span className="select">
                  <select
                    id="course-sort"
                    aria-label="Sort courses"
                    value={currentFilters.sort ?? 'featured'}
                    onChange={(event) =>
                      navigate({
                        sort:
                          event.target.value === 'featured'
                            ? undefined
                            : event.target.value,
                        page: undefined,
                      })
                    }
                  >
                    {filterOptions.sorts.map((sort) => (
                      <option value={sort.value} key={sort.value}>
                        {sort.label}
                      </option>
                    ))}
                  </select>
                  <CourseIcon name="chevron" size={15} />
                </span>
              </div>
            </div>
            <div className="course-list">
              {courses.length ? (
                courses.map((course) => (
                  <CourseTemplateCard
                    course={course}
                    countryFilter={selectedCountryForDetail}
                    key={course.id}
                  />
                ))
              ) : (
                <div className="template-empty course-zero-state">
                  <h3>No courses match these filters</h3>
                  <p>
                    Clear one or more filters to return to the published
                    catalog.
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={clearCourseFilters}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
            {meta.totalPages > 1 || meta.page > 1 ? (
              <nav
                className="template-pagination"
                aria-label="Course results pagination"
              >
                <button
                  type="button"
                  aria-label="Previous results page"
                  disabled={meta.page <= 1}
                  onClick={() =>
                    navigate({ page: String(meta.page - 1) }, true)
                  }
                >
                  Previous
                </button>
                <span aria-current="page">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  type="button"
                  aria-label="Next results page"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() =>
                    navigate({ page: String(meta.page + 1) }, true)
                  }
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      {filterOptions.levels.length ? (
        <section className="section wrap" id="degree-level">
          <div className="section-head">
            <span className="eyebrow">Qualifications</span>
            <h2>Browse courses by degree level</h2>
          </div>
          <MiniLinkGrid
            items={filterOptions.levels.map((item) => ({
              label: item.label,
              href: `/courses?level=${encodeURIComponent(item.value)}`,
              detail: `${item.count} programs`,
            }))}
          />
        </section>
      ) : null}

      {filterOptions.countries.length ? (
        <section className="section wrap" id="destinations">
          <div className="section-head">
            <span className="eyebrow">Destinations</span>
            <h2>Browse courses by study destination</h2>
          </div>
          <MiniLinkGrid
            items={filterOptions.countries.map((item) => ({
              label: item.label,
              href: `/courses?country=${encodeURIComponent(item.value)}`,
              detail: `${item.count} programs`,
            }))}
          />
        </section>
      ) : null}

      {subjects.length ? (
        <section className="section wrap" id="categories">
          <div className="section-head">
            <span className="eyebrow">Catalog pathways</span>
            <h2>Explore by subject</h2>
          </div>
          <MiniLinkGrid
            items={subjects.map((subject) => ({
              label: subject.name,
              href: `/courses?subject=${encodeURIComponent(subject.slug)}`,
              detail: `${subject.publishedCourseCount} programs`,
            }))}
          />
        </section>
      ) : null}

      <section className="section wrap">
        <div className="final-cta">
          <h2>Discover the right course for your future</h2>
          <p>
            Explore the published catalog or get help narrowing your options.
          </p>
          <div className="cta-row">
            <a href="#discovery" className="btn btn-secondary">
              Find Courses
            </a>
            <Link
              href={counsellingHref({
                source: 'course',
                from: '/courses',
              })}
              className="btn btn-outline"
            >
              Talk to a counsellor
            </Link>
          </div>
        </div>
      </section>
      <CatalogFooter />
    </main>
  );
}

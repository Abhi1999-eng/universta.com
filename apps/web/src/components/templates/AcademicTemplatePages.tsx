'use client';

/* API-selected media can come from approved external asset hosts. */
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { counsellingHref } from '@/lib/counselling-link';
import type {
  Course,
  PageMeta,
  Subject,
  SubjectDetail,
  SubSubject,
} from '@/lib/catalog';
import { CatalogFooter, CatalogHeader } from './ApprovedTemplatePages';

type AcademicIconName =
  | 'arrow'
  | 'book'
  | 'briefcase'
  | 'cap'
  | 'code'
  | 'globe'
  | 'search'
  | 'users';

const iconPaths: Record<AcademicIconName, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z',
  briefcase:
    'M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  cap: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  globe:
    'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20',
  search: 'm21 21-4.3-4.3M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
};

function AcademicIcon({
  name,
  size = 18,
}: {
  name: AcademicIconName;
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

function TruthfulEmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="template-empty">
      <h3>{title}</h3>
      <p>{detail}</p>
      {action ? (
        <Link className="link-more template-empty-action" href={action.href}>
          {action.label}
          <AcademicIcon name="arrow" size={15} />
        </Link>
      ) : null}
    </div>
  );
}

function subjectColor(index: number) {
  return index % 6 ? ` c${index % 6}` : '';
}

function SubjectImageCard({
  subject,
  index,
}: {
  subject: Subject;
  index: number;
}) {
  return (
    <Link href={`/subjects/${subject.slug}`} className="card subj-card">
      <span className={`subj-img${subjectColor(index)}`}>
        {subject.listingMedia ? (
          <img
            src={subject.listingMedia.url}
            alt={subject.listingMedia.alt ?? subject.name}
          />
        ) : (
          <span className="si">
            <AcademicIcon name={index % 3 === 0 ? 'code' : index % 3 === 1 ? 'briefcase' : 'book'} />
          </span>
        )}
      </span>
      <span className="subj-body">
        <h3>{subject.name}</h3>
        <p>{subject.shortDescription ?? 'Published subject pathway'}</p>
        <span className="subj-meta">
          <span>
            <b>{subject.publishedCourseCount}</b> courses
          </span>
          <span>
            <b>{subject.publishedSubSubjectCount}</b> specializations
          </span>
        </span>
        <span className="subj-foot">
          <span className="tuit">
            <b>{subject.availableCountryCount}</b> countries
          </span>
          <span className="go">
            Explore <AcademicIcon name="arrow" size={14} />
          </span>
        </span>
      </span>
    </Link>
  );
}

function SubjectCategoryCard({ subject }: { subject: Subject }) {
  return (
    <Link
      className="card cat-card"
      href={`/courses?subject=${encodeURIComponent(subject.slug)}`}
    >
      <span className="cat-ic">
        <AcademicIcon name="book" />
      </span>
      <span>
        <h3>{subject.name}</h3>
        <span className="cc-sub">
          {subject.publishedCourseCount} published courses
        </span>
      </span>
      <span className="go">
        <AcademicIcon name="arrow" size={15} />
      </span>
    </Link>
  );
}

function FeaturedSubjectCard({ subject }: { subject: Subject }) {
  return (
    <Link className="card feat-card" href={`/subjects/${subject.slug}`}>
      <span className="feat-top">
        <span className="feat-ic">
          <AcademicIcon name="book" />
        </span>
        <span>
          <h3>{subject.name}</h3>
          <span className="outlook">Published catalog pathway</span>
        </span>
      </span>
      <span className="feat-rows">
        <span className="feat-row">
          <span>Courses</span>
          <span>{subject.publishedCourseCount}</span>
        </span>
        <span className="feat-row">
          <span>Specializations</span>
          <span>{subject.publishedSubSubjectCount}</span>
        </span>
        <span className="feat-row">
          <span>Available countries</span>
          <span>{subject.availableCountryCount}</span>
        </span>
      </span>
    </Link>
  );
}

type CourseLevelOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

type ListingCountry = {
  id: string;
  name: string;
  slug: string;
};

export function ApprovedSubjectsListing({
  subjects,
  meta,
  query = '',
  levels,
  countries,
}: {
  subjects: Subject[];
  meta: PageMeta;
  query?: string;
  levels: CourseLevelOption[];
  countries: ListingCountry[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState(query);
  const [suggestions, setSuggestions] = useState<Subject[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const submittedQuery = searchParams.get('q') ?? '';
  const submittedQueryRef = useRef(submittedQuery);
  const suggestionRequestRef = useRef(0);
  const orderedSubjects = useMemo(
    () => [
      ...subjects.filter((subject) => subject.featured),
      ...subjects.filter((subject) => !subject.featured),
    ],
    [subjects],
  );
  const directory = useMemo(
    () =>
      subjects.reduce<Record<string, Subject[]>>((groups, subject) => {
        const letter = subject.name.slice(0, 1).toUpperCase();
        groups[letter] = [...(groups[letter] ?? []), subject];
        return groups;
      }, {}),
    [subjects],
  );
  const letters = Array.from({ length: 26 }, (_, index) =>
    String.fromCharCode(65 + index),
  );
  const totalCourses = subjects.reduce(
    (sum, subject) => sum + subject.publishedCourseCount,
    0,
  );
  const featuredCount = subjects.filter((subject) => subject.featured).length;

  useEffect(() => {
    if (submittedQueryRef.current === submittedQuery) return;
    submittedQueryRef.current = submittedQuery;
    const timer = window.setTimeout(() => setSearchQuery(submittedQuery), 0);
    return () => window.clearTimeout(timer);
  }, [submittedQuery]);

  useEffect(() => {
    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    const controller = new AbortController();
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2 || trimmedQuery === submittedQuery) {
      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      void fetch(
        `/api/subjects/suggestions?q=${encodeURIComponent(trimmedQuery)}`,
        { signal: controller.signal },
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error('Subject suggestions are unavailable.');
          }
          return response.json() as Promise<{ data?: Subject[] }>;
        })
        .then((body) => {
          if (requestId !== suggestionRequestRef.current) return;
          setSuggestions(body.data ?? []);
          setActiveSuggestion(-1);
          setSuggestionsLoading(false);
          setSuggestionsOpen(true);
        })
        .catch((error: unknown) => {
          if (
            requestId !== suggestionRequestRef.current ||
            (error as { name?: string }).name === 'AbortError'
          ) return;
          setSuggestions([]);
          setSuggestionsLoading(false);
          setSuggestionsOpen(true);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery, submittedQuery]);

  useEffect(() => {
    const closeSuggestions = (event: MouseEvent) => {
      if (!searchAreaRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', closeSuggestions);
    return () => document.removeEventListener('mousedown', closeSuggestions);
  }, []);

  function handleSubjectQueryChange(next: string) {
    const trimmedQuery = next.trim();
    setSearchQuery(next);
    setSuggestions([]);
    setActiveSuggestion(-1);
    if (trimmedQuery.length >= 2 && trimmedQuery !== submittedQuery) {
      setSuggestionsLoading(true);
      setSuggestionsOpen(true);
    } else {
      setSuggestionsLoading(false);
      setSuggestionsOpen(false);
    }
  }

  function submitSubjectSearch(value: string) {
    const next = value.trim();
    setSearchQuery(next);
    suggestionRequestRef.current += 1;
    setSuggestions([]);
    setSuggestionsLoading(false);
    setSuggestionsOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('q', next);
    else params.delete('q');
    params.delete('page');
    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  }

  function handleSubjectSearchKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
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
        submitSubjectSearch(suggestions[activeSuggestion].name);
      } else {
        submitSubjectSearch(searchQuery);
      }
    }
  }

  return (
    <main className="visual-subjects-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="sep">/</li>
            <li aria-current="page">Subjects</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-inner">
          <span className="hero-pill">
            <span className="dot" />
            <b>{meta.total}</b> subjects · <b>{totalCourses}</b> programs
          </span>
          <h1>
            Explore <span>Subjects</span>
          </h1>
          <p className="lede">
            Find the right field of study, understand its published pathways,
            and explore the courses and destinations available in the catalog.
          </p>
          <div className="subject-search-area" ref={searchAreaRef}>
            <form
              className="search-shell"
              action="/subjects"
              onSubmit={(event) => {
                event.preventDefault();
                submitSubjectSearch(searchQuery);
              }}
            >
              <div className="search-box">
                <AcademicIcon name="search" />
                <input
                  name="q"
                  role="combobox"
                  value={searchQuery}
                  placeholder="Search by subject or keyword..."
                  aria-label="Search subjects"
                  aria-expanded={suggestionsOpen}
                  aria-controls="subject-suggestions"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    suggestionsOpen &&
                    activeSuggestion >= 0 &&
                    suggestions[activeSuggestion]
                      ? `subject-suggestion-${suggestions[activeSuggestion].id}`
                      : undefined
                  }
                  onChange={(event) =>
                    handleSubjectQueryChange(event.target.value)
                  }
                  onKeyDown={handleSubjectSearchKeyDown}
                />
                <button className="btn btn-primary" type="submit">
                  Explore Subjects
                </button>
              </div>
            </form>
            {suggestionsOpen ? (
              <ul
                className="suggest open"
                id="subject-suggestions"
                role="listbox"
                aria-busy={suggestionsLoading}
              >
                {suggestionsLoading ? (
                  <li className="suggest-group-label" role="status">
                    Loading subjects…
                  </li>
                ) : suggestions.length ? (
                  suggestions.map((suggestion, index) => (
                    <li
                      className={`suggest-item${
                        index === activeSuggestion ? ' hl' : ''
                      }`}
                      role="presentation"
                      key={suggestion.id}
                    >
                      <button
                        type="button"
                        id={`subject-suggestion-${suggestion.id}`}
                        role="option"
                        aria-label={suggestion.name}
                        aria-selected={index === activeSuggestion}
                        onMouseEnter={() => setActiveSuggestion(index)}
                        onClick={() => submitSubjectSearch(suggestion.name)}
                      >
                        <span className="sic">
                          <AcademicIcon name="book" />
                        </span>
                        <span>
                          <span className="st">{suggestion.name}</span>
                          <span className="sd">
                            {suggestion.publishedCourseCount} published courses
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="suggest-group-label" role="status">
                    No subjects found.
                  </li>
                )}
              </ul>
            ) : null}
          </div>
          <div className="hero-ctas">
            <a href="#popular" className="btn btn-primary">
              Explore Subjects
            </a>
            <Link
              href={counsellingHref({
                source: 'general',
                from: '/subjects',
              })}
              className="btn btn-secondary"
            >
              Book Free Counselling
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hstat">
              <div className="num">{meta.total}</div>
              <div className="lbl">Subjects</div>
            </div>
            <div className="hstat">
              <div className="num">{totalCourses}</div>
              <div className="lbl">Courses</div>
            </div>
            <div className="hstat">
              <div className="num">{countries.length}</div>
              <div className="lbl">Countries</div>
            </div>
            <div className="hstat">
              <div className="num">{featuredCount}</div>
              <div className="lbl">Featured subjects</div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap academic-intro">
        <p>
          Your subject shapes your course shortlist and the destinations
          available to you. Browse published fields by category or A–Z, then
          move directly into the real programs currently available.
        </p>
      </section>

      <div className="wrap layout academic-layout">
        <div className="main">
          <section className="section" id="popular">
            <div className="section-head row-between">
              <div>
                <span className="eyebrow">Trending</span>
                <h2>Popular subjects</h2>
                <p className="sub">
                  Featured fields from the published catalog.
                </p>
              </div>
              <a href="#az" className="link-more">
                A–Z directory <AcademicIcon name="arrow" size={16} />
              </a>
            </div>
            <div className="grid g3">
              {orderedSubjects.length ? (
                orderedSubjects
                  .slice(0, 6)
                  .map((subject, index) => (
                    <SubjectImageCard
                      subject={subject}
                      index={index}
                      key={subject.id}
                    />
                  ))
              ) : (
                <TruthfulEmptyState
                  title="No subjects match this search"
                  detail="Clear the search or try a broader subject keyword."
                  action={{ label: 'Clear search', href: '/subjects' }}
                />
              )}
            </div>
          </section>

          <section className="section" id="categories">
            <div className="section-head">
              <span className="eyebrow">By field</span>
              <h2>Browse by category</h2>
            </div>
            <div className="grid g3">
              {subjects.length ? (
                subjects.map((subject) => (
                  <SubjectCategoryCard subject={subject} key={subject.id} />
                ))
              ) : (
                <TruthfulEmptyState
                  title="No subject categories found"
                  detail="Published subject fields will appear here when they match the current search."
                />
              )}
            </div>
          </section>

          <section className="section" id="az">
            <div className="section-head">
              <span className="eyebrow">Full index</span>
              <h2>A–Z subject directory</h2>
            </div>
            <nav className="az-nav" aria-label="Subject directory letters">
              {letters.map((letter) =>
                directory[letter]?.length ? (
                  <a href={`#subject-letter-${letter}`} key={letter}>
                    {letter}
                  </a>
                ) : (
                  <span className="disabled" aria-disabled="true" key={letter}>
                    {letter}
                  </span>
                ),
              )}
            </nav>
            {Object.keys(directory).length ? (
              Object.entries(directory)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, items]) => (
                  <section
                    className="az-group"
                    id={`subject-letter-${letter}`}
                    key={letter}
                  >
                    <h3 className="az-letter">{letter}</h3>
                    <div className="az-items">
                      {items.map((subject) => (
                        <Link
                          className="az-item"
                          href={`/subjects/${subject.slug}`}
                          key={subject.id}
                        >
                          {subject.name}
                          <span className="cnt">
                            {subject.publishedCourseCount} courses
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))
            ) : (
              <TruthfulEmptyState
                title="The subject directory is empty"
                detail="No published subject names match the current search."
              />
            )}
          </section>

          <section className="section section-card" id="degrees">
            <div className="section-head">
              <span className="eyebrow">By qualification</span>
              <h2>Browse by degree level</h2>
            </div>
            <div className="grid g4">
              {levels.map((level) => (
                <Link
                  className="card mini-card"
                  href={`/courses?level=${encodeURIComponent(level.code)}`}
                  key={level.id}
                >
                  <span className="mini-ic">
                    <AcademicIcon name="cap" />
                  </span>
                  <span>
                    <h3>{level.name}</h3>
                    <span className="mc-sub">View published courses</span>
                  </span>
                  <span className="go">
                    <AcademicIcon name="arrow" size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section" id="careers">
            <div className="section-head">
              <span className="eyebrow">By goal</span>
              <h2>Browse by career</h2>
              <p className="sub">
                Career-to-subject mappings are not yet part of the Phase 1
                catalog.
              </p>
            </div>
            <TruthfulEmptyState
              title="Career pathways are not yet published"
              detail="Explore subjects directly or ask a counsellor to help translate your study goals into a shortlist."
              action={{
                label: 'Book free counselling',
                href: counsellingHref({
                  source: 'general',
                  from: '/subjects',
                }),
              }}
            />
          </section>

          <section className="section section-card" id="featured">
            <div className="section-head">
              <span className="eyebrow">Deep dive</span>
              <h2>Featured subjects</h2>
            </div>
            <div className="grid g3">
              {(subjects.filter((subject) => subject.featured).length
                ? subjects.filter((subject) => subject.featured)
                : orderedSubjects.slice(0, 3)
              ).map((subject) => (
                <FeaturedSubjectCard subject={subject} key={subject.id} />
              ))}
            </div>
          </section>

          <section className="section" id="destinations">
            <div className="section-head">
              <span className="eyebrow">Where to study</span>
              <h2>Study destinations by subject</h2>
            </div>
            <TruthfulEmptyState
              title="Subject-specific destination rankings are not published"
              detail={`${countries.length} published destinations can still be explored and compared using their verified country profiles.`}
              action={{ label: 'Explore countries', href: '/countries' }}
            />
          </section>

          <section className="section" id="why">
            <div className="section-head">
              <span className="eyebrow">Make the choice</span>
              <h2>Choose a subject with real catalog context</h2>
            </div>
            <div className="grid g3">
              {[
                ['Published pathways', 'See the specializations available under each field.'],
                ['Real course links', 'Move from a subject into API-backed course results.'],
                ['Destination context', 'Compare the countries where published courses are available.'],
              ].map(([title, detail], index) => (
                <article className="card why-card" key={title}>
                  <span className="why-ic">
                    <AcademicIcon
                      name={index === 0 ? 'book' : index === 1 ? 'cap' : 'globe'}
                    />
                  </span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="section section-card" id="explore">
            <div className="section-head">
              <span className="eyebrow">Keep exploring</span>
              <h2>Explore more</h2>
            </div>
            <div className="explore-grid">
              {([
                ['Subjects', '/subjects', 'book'],
                ['Courses', '/courses', 'cap'],
                ['Countries', '/countries', 'globe'],
              ] as Array<[string, string, AcademicIconName]>).map(
                ([label, href, icon]) => (
                <Link
                  className="card explore-item"
                  href={href}
                  key={label}
                >
                  <span className="explore-ic">
                    <AcademicIcon name={icon} />
                  </span>
                  <span className="en">{label}</span>
                  <span className="go">
                    <AcademicIcon name="arrow" size={15} />
                  </span>
                </Link>
                ),
              )}
            </div>
          </section>
        </div>

        <aside className="side">
          <div className="side-card">
            <h3>Not sure which subject?</h3>
            <p>
              Start with published pathways or get help narrowing your study
              goals.
            </p>
            <Link href="/courses" className="btn btn-primary btn-block">
              Find Courses
            </Link>
            <Link
              href={counsellingHref({
                source: 'general',
                from: '/subjects',
              })}
              className="btn btn-outline btn-block"
            >
              Book Counselling
            </Link>
          </div>
        </aside>
      </div>

      <section className="wrap academic-final-cta">
        <div className="final-cta">
          <h2>Find the right subject for your future</h2>
          <p>
            Discover published fields, explore real programs, and get
            counselling support for your next step.
          </p>
          <div className="cta-row">
            <Link href="/courses" className="btn btn-secondary">
              Explore Courses
            </Link>
            <Link
              href={counsellingHref({
                source: 'general',
                from: '/subjects',
              })}
              className="btn btn-outline"
            >
              Book Free Counselling
            </Link>
          </div>
        </div>
      </section>
      <CatalogFooter />
    </main>
  );
}

function SubjectBlock({
  id,
  eyebrow,
  title,
  card = false,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  card?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`block${card ? ' section-card' : ''}`} id={id}>
      <div className="block-head">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CourseMiniCard({ course }: { course: Course }) {
  const duration = course.duration.min
    ? `${course.duration.min}${course.duration.max && course.duration.max !== course.duration.min ? `–${course.duration.max}` : ''} ${course.duration.unit ?? ''}`
    : 'Varies';
  return (
    <Link href={`/courses/${course.slug}`} className="card course-card">
      <span className="cc-lvl">{course.courseLevel.name}</span>
      <h3>{course.name}</h3>
      <div className="cc-uni">{course.subject.name}</div>
      <div className="cc-facts">
        <div>
          <b>{duration}</b>Duration
        </div>
        <div>
          <b>{course.availableCountryCount}</b>Countries
        </div>
      </div>
    </Link>
  );
}

export function ApprovedSubjectDetail({
  subject,
}: {
  subject: SubjectDetail;
}) {
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}`,
  });
  const levelTotal = subject.courseCountsByLevel.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const toc = [
    ['glance', 'At a glance'],
    ['about', 'About'],
    ['specializations', 'Specializations'],
    ['degree-levels', 'Degree levels'],
    ['courses', 'Courses'],
    ['countries', 'Countries'],
  ];

  return (
    <main className="visual-subject-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="sep">/</li>
            <li>
              <Link href="/subjects">Subjects</Link>
            </li>
            <li className="sep">/</li>
            <li aria-current="page">{subject.name}</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap">
          <div className="hero-banner">
            <span className="hero-parent">
              <AcademicIcon name="cap" size={14} />
              Published subject
            </span>
            <h1>{subject.name}</h1>
            <p className="lede">
              {subject.shortDescription ??
                subject.overview ??
                'Explore the published pathways for this subject.'}
            </p>
            <div className="hero-metrics">
              <div className="hm">
                <div className="v">{subject.publishedCourseCount}</div>
                <div className="k">Courses</div>
              </div>
              <div className="hm">
                <div className="v">{subject.publishedSubSubjectCount}</div>
                <div className="k">Specializations</div>
              </div>
              <div className="hm">
                <div className="v">{subject.availableCountryCount}</div>
                <div className="k">Countries</div>
              </div>
              <div className="hm">
                <div className="v">{subject.courseCountsByLevel.length}</div>
                <div className="k">Degree levels</div>
              </div>
              <div className="hm">
                <div className="v">{subject.featuredCourses.length}</div>
                <div className="k">Featured courses</div>
              </div>
            </div>
            <div className="hero-cta">
              <Link
                href={`/courses?subject=${subject.slug}`}
                className="btn btn-white"
              >
                Explore Courses
              </Link>
              <Link
                href={`/subjects/${subject.slug}/specializations`}
                className="btn btn-glass"
              >
                View Specializations
              </Link>
              <Link href={counselling} className="btn btn-glass">
                Book Free Counselling
              </Link>
            </div>
          </div>
        </div>
      </section>

      <nav className="toc" aria-label="On this page">
        <div className="wrap toc-inner">
          {toc.map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="wrap layout">
        <div className="main">
          <SubjectBlock
            id="glance"
            eyebrow="Snapshot"
            title={`${subject.name} at a glance`}
          >
            <div className="kpi-grid">
              {[
                ['Courses', subject.publishedCourseCount],
                ['Specializations', subject.publishedSubSubjectCount],
                ['Countries', subject.availableCountryCount],
                ['Degree levels', subject.courseCountsByLevel.length],
                ['Courses grouped by level', levelTotal],
              ].map(([label, value]) => (
                <div className="kpi" key={label}>
                  <span className="kk">{label}</span>
                  <strong className="kv">{value}</strong>
                </div>
              ))}
            </div>
          </SubjectBlock>

          <SubjectBlock
            id="about"
            eyebrow="Overview"
            title={`About ${subject.name}`}
            card
          >
            <div className="prose">
              <p>
                {subject.overview ??
                  subject.shortDescription ??
                  'A detailed overview is not yet published.'}
              </p>
            </div>
          </SubjectBlock>

          <SubjectBlock
            id="specializations"
            eyebrow="Focus areas"
            title="Specializations"
          >
            <div className="grid g2">
              {subject.subSubjects.length ? (
                subject.subSubjects.map((item) => (
                  <Link
                    className="card spec-card"
                    href={`/subjects/${subject.slug}/specializations#${item.slug}`}
                    key={item.id}
                  >
                    <span className="spec-ic">
                      <AcademicIcon name="code" />
                    </span>
                    <span>
                      <span className="sn">{item.name}</span>
                      <span className="sd">
                        {item.shortDescription ?? 'Published specialization'}
                      </span>
                    </span>
                    <AcademicIcon name="arrow" />
                  </Link>
                ))
              ) : (
                <TruthfulEmptyState
                  title="No specializations are currently published"
                  detail="This subject does not yet have published focus areas."
                />
              )}
            </div>
          </SubjectBlock>

          <SubjectBlock
            id="degree-levels"
            eyebrow="Qualifications"
            title="Courses by degree level"
            card
          >
            <div className="grid g3">
              {subject.courseCountsByLevel.length ? (
                subject.courseCountsByLevel.map(({ level, count }) => (
                  <Link
                    className="card kpi"
                    href={`/courses?subject=${subject.slug}&level=${encodeURIComponent(level.code ?? '')}`}
                    key={level.id}
                  >
                    <span className="kk">{level.name}</span>
                    <strong className="kv">{count}</strong>
                  </Link>
                ))
              ) : (
                <TruthfulEmptyState
                  title="Degree-level counts are not yet published"
                  detail="Use the course results to view the currently available qualifications."
                  action={{
                    label: 'Browse courses',
                    href: `/courses?subject=${subject.slug}`,
                  }}
                />
              )}
            </div>
          </SubjectBlock>

          <SubjectBlock
            id="courses"
            eyebrow="Related programs"
            title="Popular courses"
          >
            <div className="grid g3">
              {subject.featuredCourses.length ? (
                subject.featuredCourses.map((course) => (
                  <CourseMiniCard course={course} key={course.id} />
                ))
              ) : (
                <TruthfulEmptyState
                  title="No featured courses are currently published"
                  detail="Open the full subject-filtered result set to see all available programs."
                  action={{
                    label: 'Browse all courses',
                    href: `/courses?subject=${subject.slug}`,
                  }}
                />
              )}
            </div>
          </SubjectBlock>

          <SubjectBlock
            id="countries"
            eyebrow="Where to study"
            title={`Study ${subject.name} abroad`}
            card
          >
            <div className="subject-country-callout">
              <span className="subject-country-icon">
                <AcademicIcon name="globe" />
              </span>
              <div>
                <h3>
                  Available across {subject.availableCountryCount} published
                  countries
                </h3>
                <p>
                  Country names and availability belong to the live course
                  catalog; no ranking or tuition averages are inferred here.
                </p>
              </div>
              <Link
                href={`/courses?subject=${subject.slug}`}
                className="btn btn-primary btn-sm"
              >
                View destinations
              </Link>
            </div>
          </SubjectBlock>
        </div>

        <aside className="side">
          <div className="side-card">
            <span className="eyebrow">Study this subject</span>
            <h3>{subject.name}</h3>
            <p>
              {subject.publishedCourseCount} published courses across{' '}
              {subject.availableCountryCount} countries.
            </p>
            <Link
              href={`/courses?subject=${subject.slug}`}
              className="btn btn-primary btn-block"
            >
              Explore Courses
            </Link>
            <Link href={counselling} className="btn btn-outline btn-block">
              Book Counselling
            </Link>
          </div>
        </aside>
      </div>

      <section className="wrap academic-final-cta">
        <div className="final-cta">
          <h2>Ready to study {subject.name} abroad?</h2>
          <p>
            Explore published courses or get help shaping your next step.
          </p>
          <div className="cta-row">
            <Link
              href={`/courses?subject=${subject.slug}`}
              className="btn btn-secondary"
            >
              Explore Courses
            </Link>
            <Link href={counselling} className="btn btn-outline">
              Book Free Counselling
            </Link>
          </div>
        </div>
      </section>
      <CatalogFooter />
    </main>
  );
}

function SpecializationCard({
  item,
  subject,
  index,
  id,
}: {
  item: SubSubject;
  subject: SubjectDetail;
  index: number;
  id?: string;
}) {
  return (
    <article className="card spec-card" id={id}>
      <div className={`spec-band${subjectColor(index)}`} />
      <div className="spec-body">
        <div className="spec-top">
          <div className="spec-ic">
            {item.iconMedia ? (
              <img
                src={item.iconMedia.url}
                alt={item.iconMedia.alt ?? ''}
              />
            ) : (
              <AcademicIcon name="code" />
            )}
          </div>
          <div>
            <h3>{item.name}</h3>
          </div>
        </div>
        <p className="spec-desc">
          {item.shortDescription ??
            item.overview ??
            'Published specialization pathway'}
        </p>
        <div className="spec-foot">
          <Link
            href={`/courses?subject=${subject.slug}&subSubject=${item.slug}`}
            className="go"
          >
            Explore courses <AcademicIcon name="arrow" size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ApprovedSpecializations({
  subject,
}: {
  subject: SubjectDetail;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const submittedQuery = searchParams.get('q') ?? '';
  const resultsRef = useRef<HTMLElement>(null);
  const focusResultsAfterNavigationRef = useRef(false);
  const normalizedQuery = submittedQuery.trim().toLowerCase();
  const filtered = subject.subSubjects.filter((item) => {
    const searchable = [
      item.name,
      item.shortDescription ?? '',
      item.overview ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
  const featured = subject.subSubjects.filter((item) => item.featured);
  const popular = featured.length ? featured : subject.subSubjects.slice(0, 3);
  const counselling = counsellingHref({
    source: 'subject',
    subject: subject.slug,
    from: `/subjects/${subject.slug}/specializations`,
  });

  const focusResults = useCallback(() => {
    resultsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    resultsRef.current?.focus({ preventScroll: true });
  }, []);

  function navigateSearch(nextValue: string) {
    const next = nextValue.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('q', next);
    else params.delete('q');
    params.delete('page');
    const queryString = params.toString();
    const destination = `${pathname}${queryString ? `?${queryString}` : ''}`;
    focusResultsAfterNavigationRef.current = true;
    if (destination === `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`) {
      window.requestAnimationFrame(focusResults);
      focusResultsAfterNavigationRef.current = false;
      return;
    }
    router.push(destination, {
      scroll: false,
    });
  }

  useEffect(() => {
    if (!focusResultsAfterNavigationRef.current) return;
    focusResultsAfterNavigationRef.current = false;
    const frame = window.requestAnimationFrame(focusResults);
    return () => window.cancelAnimationFrame(frame);
  }, [focusResults, submittedQuery]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    navigateSearch(typeof value === 'string' ? value : '');
  }

  return (
    <main className="visual-specializations-page">
      <CatalogHeader active="subjects" />
      <div className="wrap crumbs">
        <nav aria-label="Breadcrumb">
          <ol>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="sep">/</li>
            <li>
              <Link href="/subjects">Subjects</Link>
            </li>
            <li className="sep">/</li>
            <li>
              <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
            </li>
            <li className="sep">/</li>
            <li aria-current="page">Specializations</li>
          </ol>
        </nav>
      </div>

      <section className="hero">
        <div className="wrap hero-inner">
          <span className="parent-pill">
            <span className="pic">
              <AcademicIcon name="code" size={14} />
            </span>
            Part of <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
          </span>
          <h1>
            Explore <span>{subject.name}</span>
            <br />
            Specializations
          </h1>
          <p className="lede">
            Narrow your path using the focused specializations currently
            published for {subject.name}.
          </p>
          <form className="search-shell" onSubmit={submitSearch}>
            <div className="search-box">
              <AcademicIcon name="search" />
              <input
                defaultValue={submittedQuery}
                key={submittedQuery}
                name="q"
                placeholder="Search specializations..."
                aria-label="Search specializations"
              />
              <button type="submit" className="btn btn-primary">
                Find specializations
              </button>
            </div>
          </form>
          <div className="hero-ctas">
            <a href="#all" className="btn btn-primary">
              Explore Specializations
            </a>
            <Link href={counselling} className="btn btn-secondary">
              Book Free Counselling
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hstat">
              <div className="num">{subject.publishedSubSubjectCount}</div>
              <div className="lbl">Specializations</div>
            </div>
            <div className="hstat">
              <div className="num">{subject.publishedCourseCount}</div>
              <div className="lbl">Courses</div>
            </div>
            <div className="hstat">
              <div className="num">{subject.availableCountryCount}</div>
              <div className="lbl">Countries</div>
            </div>
            <div className="hstat">
              <div className="num">{featured.length}</div>
              <div className="lbl">Featured pathways</div>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap academic-intro">
        <p>
          {subject.name} is divided into focused study paths. Use the published
          descriptions below to narrow your interest, then move into
          specialization-filtered course results.
        </p>
      </section>

      <div className="wrap layout academic-layout">
        <div className="main">
          {!normalizedQuery ? (
            <>
              <section className="section" id="popular">
                <div className="section-head">
                  <span className="eyebrow">Trending</span>
                  <h2>Popular specializations</h2>
                  <p className="sub">
                    Featured paths in the published {subject.name} catalog.
                  </p>
                </div>
                <div className="grid g3">
                  {popular.length ? (
                    popular.map((item, index) => (
                      <SpecializationCard
                        item={item}
                        subject={subject}
                        index={index}
                        key={item.id}
                      />
                    ))
                  ) : (
                    <TruthfulEmptyState
                      title="No specializations are currently published"
                      detail="Published focus areas will appear here when they are available."
                    />
                  )}
                </div>
              </section>

              <section className="section section-card" id="categories">
                <div className="section-head">
                  <span className="eyebrow">Sub-fields</span>
                  <h2>Browse by category</h2>
                </div>
                <TruthfulEmptyState
                  title="Specialization categories are not yet published"
                  detail="Phase 1 publishes individual specialization records without inventing a category taxonomy."
                />
              </section>
            </>
          ) : null}

          <section
            className="section"
            id="all"
            ref={resultsRef}
            tabIndex={-1}
            aria-live="polite"
          >
            <div className="section-head">
              <span className="eyebrow">All paths</span>
              <h2>All specializations</h2>
              <p className="sub">
                {normalizedQuery
                  ? `${filtered.length} result${filtered.length === 1 ? '' : 's'} for “${submittedQuery.trim()}”.`
                  : `${filtered.length} published specialization${filtered.length === 1 ? '' : 's'}.`}
              </p>
              {normalizedQuery ? (
                <button
                  type="button"
                  className="link-more specialization-clear-search"
                  onClick={() => navigateSearch('')}
                >
                  Clear search
                </button>
              ) : null}
            </div>
            <div className="grid g3">
              {filtered.length ? (
                filtered.map((item, index) => (
                  <SpecializationCard
                    item={item}
                    subject={subject}
                    index={index}
                    id={item.slug}
                    key={item.id}
                  />
                ))
              ) : (
                <TruthfulEmptyState
                  title="No specializations match this search"
                  detail="Try a broader keyword or clear the search field to restore all published paths."
                />
              )}
            </div>
          </section>

          <section className="section section-card" id="courses">
            <div className="section-head row-between">
              <div>
                <span className="eyebrow">Programs</span>
                <h2>Popular courses</h2>
              </div>
              <Link
                href={`/courses?subject=${subject.slug}`}
                className="link-more"
              >
                All {subject.name} courses
                <AcademicIcon name="arrow" size={16} />
              </Link>
            </div>
            <div className="grid g3">
              {subject.featuredCourses.length ? (
                subject.featuredCourses.map((course) => (
                  <CourseMiniCard course={course} key={course.id} />
                ))
              ) : (
                <TruthfulEmptyState
                  title="No featured courses are currently published"
                  detail="Open all subject-filtered courses to continue exploring."
                  action={{
                    label: 'Explore courses',
                    href: `/courses?subject=${subject.slug}`,
                  }}
                />
              )}
            </div>
          </section>
        </div>

        <aside className="side">
          <div className="side-card">
            <span className="eyebrow">Find your specialization</span>
            <h3>Choose the right {subject.name} path</h3>
            <p>Compare the currently published focus areas.</p>
            <Link
              href={`/courses?subject=${subject.slug}`}
              className="btn btn-primary btn-block"
            >
              Explore Courses
            </Link>
            <Link href={counselling} className="btn btn-outline btn-block">
              Book Counselling
            </Link>
          </div>
        </aside>
      </div>

      <section className="wrap academic-final-cta">
        <div className="final-cta">
          <h2>Ready to choose your {subject.name} path?</h2>
          <p>
            Explore specialization-filtered courses or talk through the options
            with a counsellor.
          </p>
          <div className="cta-row">
            <Link
              href={`/courses?subject=${subject.slug}`}
              className="btn btn-secondary"
            >
              Explore Courses
            </Link>
            <Link href={counselling} className="btn btn-outline">
              Book Free Counselling
            </Link>
          </div>
        </div>
      </section>
      <CatalogFooter />
    </main>
  );
}

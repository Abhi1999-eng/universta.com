'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Subject } from '@/lib/catalog';
import { formatNumber } from '@/lib/format';

/** The client-approved Subjects page.
 *
 * The template's "150+ subjects · 300,000+ programs", average salaries, global
 * demand percentages, employer logos and career-outcome dashboard are prototype
 * copy. Universta publishes subjects with real course, specialisation and
 * destination counts and nothing else, so the counts are real and the salary,
 * demand and employer blocks are omitted — as is the subject-category tier,
 * which has no equivalent in the catalogue (a subject's children are
 * specialisations, and those have their own page).
 *
 * Search writes to the URL and the server re-queries, so a filtered subject
 * list is shareable; the prototype filtered a hard-coded in-page array. */

export type SubjectsReferenceProps = {
  subjects: Subject[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  query: string;
  levels: Array<{ id: string; name: string; code: string }>;
  countries: Array<{ id: string; name: string; slug: string }>;
  universities: Array<{ name: string; slug: string; country: string | null }>;
  courses: Array<{ name: string; slug: string; subject: string; level: string }>;
  scholarships: Array<{ title: string; slug: string; amount: string | null; type: string | null }>;
  totals: { courses: number; universities: number; scholarships: number };
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const WHY = [
  { h: 'Published records', p: 'Every subject links to real courses.' },
  { h: 'Real counts', p: 'Course, specialisation and destination totals.' },
  { h: 'Compare side by side', p: 'Shortlist courses from any subject.' },
  { h: 'Destination context', p: 'See where a subject is actually taught.' },
  { h: 'Funding in one place', p: 'Scholarships linked to the same catalogue.' },
];

const FAQS = [
  {
    q: 'What is the difference between a subject and a specialisation?',
    a: 'A subject is the broad discipline — Computer Science, for example. A specialisation is a named strand inside it, such as Artificial Intelligence. Each subject page lists its published specialisations.',
  },
  {
    q: 'How do I find courses in a subject?',
    a: 'Open the subject and use its course list, or filter the main course catalogue by that subject. Both read from the same published records.',
  },
  {
    q: 'Why do some subjects show fewer destinations than others?',
    a: 'The destination count is the number of countries with at least one published course offering in that subject. It grows as offerings are published, and is never estimated.',
  },
  {
    q: 'Can I see scholarships for a specific subject?',
    a: 'Yes — the scholarships listing has a subject filter, and awards that name a subject are linked to it directly.',
  },
];

const SKIP_WORDS = new Set(['of', 'in', 'and', 'the', 'for', 'a', 'an', '&']);

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

export function SubjectsReference(props: SubjectsReferenceProps) {
  const { subjects, meta, levels, countries } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(props.query);

  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    router.push(`${pathname}${params.size ? `?${params}` : ''}#all`);
  }

  const sorted = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Subject[]>();
    for (const subject of sorted) {
      const letter = subject.name[0]?.toUpperCase() ?? '#';
      const bucket = map.get(letter);
      if (bucket) bucket.push(subject);
      else map.set(letter, [subject]);
    }
    return [...map.entries()];
  }, [sorted]);

  const activeLetters = new Set(groups.map(([letter]) => letter));

  const popular = [...subjects]
    .sort((a, b) => b.publishedCourseCount - a.publishedCourseCount)
    .slice(0, 6);
  const featured = subjects.filter((subject) => subject.featured).slice(0, 3);

  return (
    <div className="cref cref-subj">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> ›{' '}
          <Link href="/subjects" aria-current="page">
            Subjects
          </Link>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          {meta.total ? (
            <span className="hero-pill">
              <span className="dot" aria-hidden="true" /> <b>{meta.total}</b>&nbsp;subjects ·{' '}
              <b>{formatNumber(props.totals.courses)}</b>&nbsp;courses
            </span>
          ) : null}
          <h1 style={{ marginTop: 16 }}>
            Explore <span className="b">subjects</span>
          </h1>
          <p className="lead">
            Find the right field of study, see how many courses and destinations publish it, then
            jump straight to the programmes, universities and scholarships that teach it.
          </p>

          <form
            className="searchwrap"
            onSubmit={(event) => {
              event.preventDefault();
              commit({ q: query.trim() || null });
            }}
          >
            <div className="searchbar">
              <span className="ic" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search subjects…"
                aria-label="Search subjects"
              />
              <button type="submit" className="btn btn-primary">
                Explore subjects
              </button>
            </div>
          </form>

          <div className="hero-ctas">
            <a href="#all" className="btn btn-primary btn-lg">
              Browse all subjects
            </a>
            <Link href="/courses" className="btn btn-outline btn-lg">
              Browse courses
            </Link>
          </div>

          <div className="statgrid four">
            <div className="stat">
              <b>{meta.total || '—'}</b>
              <span>Subjects</span>
            </div>
            <div className="stat">
              <b>{props.totals.courses ? formatNumber(props.totals.courses) : '—'}</b>
              <span>Courses</span>
            </div>
            <div className="stat">
              <b>{props.totals.universities ? formatNumber(props.totals.universities) : '—'}</b>
              <span>Universities</span>
            </div>
            <div className="stat">
              <b>{countries.length || '—'}</b>
              <span>Destinations</span>
            </div>
          </div>
        </div>
      </section>

      <section className="wrap" style={{ padding: '32px 0 0' }}>
        <div className="prose">
          <p>
            Your subject shapes your course shortlist, your destination and the funding you can
            apply for. Browse every published discipline below, or search for one by name — each
            subject opens onto its specialisations, its courses and the destinations that teach it.
          </p>
        </div>
      </section>

      <div className="wrap layout" style={{ paddingTop: 44 }}>
        <main className="main">
          {/* POPULAR */}
          {popular.length ? (
            <section className="section" id="popular" style={{ paddingTop: 0 }}>
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Most courses</span>
                  <h2>Popular subjects</h2>
                  <p className="sub">The disciplines with the most published courses right now.</p>
                </div>
                <a className="link-more" href="#all">
                  All subjects →
                </a>
              </div>
              <div className="grid g3">
                {popular.map((subject, index) => (
                  <Link key={subject.id} href={`/subjects/${subject.slug}`} className="card subjtile">
                    <div className={`subj-img c${index % 6}`}>
                      <span className="si" aria-hidden="true">
                        {initials(subject.name)}
                      </span>
                    </div>
                    <div className="subj-body">
                      <h3>{subject.name}</h3>
                      <div className="subj-meta">
                        <span>
                          <b>{formatNumber(subject.publishedCourseCount)}</b> courses
                        </span>
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
                        <span className="tuit">
                          {subject.shortDescription ? '' : 'Published subject'}
                        </span>
                        <span className="go">Explore →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* A–Z */}
          <section className="section" id="all">
            <div className="section-head">
              <span className="eyebrow">Every subject</span>
              <h2>Browse subjects A–Z</h2>
              <p className="sub">
                {props.query
                  ? `${meta.total} subject${meta.total === 1 ? '' : 's'} matching “${props.query}”.`
                  : 'Every published discipline, with its course count.'}
              </p>
            </div>

            <div className="az-nav">
              {LETTERS.map((letter) =>
                activeLetters.has(letter) ? (
                  <a key={letter} href={`#letter-${letter}`}>
                    {letter}
                  </a>
                ) : (
                  <span key={letter} aria-hidden="true">
                    {letter}
                  </span>
                ),
              )}
            </div>

            {groups.length === 0 ? (
              <div className="cref-empty" data-testid="subject-empty">
                <h3>No subjects match that search</h3>
                <p>Try a different term, or browse the full list.</p>
                <Link className="btn btn-primary" href="/subjects#all">
                  Clear search
                </Link>
              </div>
            ) : (
              groups.map(([letter, items]) => (
                <div className="az-group" id={`letter-${letter}`} key={letter}>
                  <h3 className="az-letter">{letter}</h3>
                  <div className="az-items">
                    {items.map((subject) => (
                      <Link key={subject.id} className="az-item" href={`/subjects/${subject.slug}`}>
                        {subject.name}
                        <span className="cnt">{formatNumber(subject.publishedCourseCount)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          {/* DEGREE LEVELS */}
          {levels.length ? (
            <section className="section" id="degrees">
              <div className="section-head">
                <span className="eyebrow">By qualification</span>
                <h2>Study a subject at any level</h2>
                <p className="sub">Every degree level the catalogue publishes.</p>
              </div>
              <div className="grid g4">
                {levels.map((level) => (
                  <Link
                    key={level.id}
                    href={`/courses?level=${level.code}#discovery`}
                    className="card mini-card"
                  >
                    <span className="mini-ic" aria-hidden="true">
                      {initials(level.name)}
                    </span>
                    <div>
                      <h3>{level.name}</h3>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* FEATURED */}
          {featured.length ? (
            <section className="section" id="featured">
              <div className="section-head">
                <span className="eyebrow">Editor’s picks</span>
                <h2>Featured subjects</h2>
                <p className="sub">Subjects an admin has marked as featured in the catalogue.</p>
              </div>
              <div className="grid g3">
                {featured.map((subject) => (
                  <article className="card feat-card" key={subject.id}>
                    <div className="feat-top">
                      <span className="feat-ic" aria-hidden="true">
                        {initials(subject.name)}
                      </span>
                      <h3>{subject.name}</h3>
                    </div>
                    {subject.shortDescription ? (
                      <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                        {subject.shortDescription}
                      </p>
                    ) : null}
                    <div className="feat-rows">
                      <div className="feat-row">
                        <span>Courses</span>
                        <span>{formatNumber(subject.publishedCourseCount)}</span>
                      </div>
                      <div className="feat-row">
                        <span>Specialisations</span>
                        <span>{subject.publishedSubSubjectCount}</span>
                      </div>
                      <div className="feat-row">
                        <span>Destinations</span>
                        <span>{subject.availableCountryCount}</span>
                      </div>
                    </div>
                    <Link className="btn btn-ghost btn-sm" href={`/subjects/${subject.slug}`}>
                      Explore {subject.name}
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* DESTINATIONS */}
          {countries.length ? (
            <section className="section" id="destinations">
              <div className="section-head">
                <span className="eyebrow">Where to study</span>
                <h2>Destinations teaching these subjects</h2>
                <p className="sub">Every destination with published course offerings.</p>
              </div>
              <div className="card dest-block">
                <h3>Browse a subject in a destination</h3>
                <div className="dest-flags">
                  {countries.map((country) => (
                    <Link
                      key={country.id}
                      className="dest-flag"
                      href={`/courses?country=${country.slug}#discovery`}
                    >
                      <span className="cc">{initials(country.name)}</span>
                      {country.name}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* UNIVERSITIES */}
          {props.universities.length ? (
            <section className="section" id="universities">
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Institutions</span>
                  <h2>Universities teaching these subjects</h2>
                </div>
                <Link className="link-more" href="/universities">
                  All universities →
                </Link>
              </div>
              <div className="grid g2">
                {props.universities.map((university) => (
                  <Link
                    key={university.slug}
                    className="card uni-row"
                    href={`/universities/${university.slug}`}
                  >
                    <span className="ulogo" aria-hidden="true">
                      {initials(university.name)}
                    </span>
                    <div>
                      <h3>{university.name}</h3>
                      {university.country ? <div className="um">{university.country}</div> : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* COURSES */}
          {props.courses.length ? (
            <section className="section" id="courses">
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Programmes</span>
                  <h2>Popular courses by subject</h2>
                </div>
                <Link className="link-more" href="/courses">
                  All courses →
                </Link>
              </div>
              <div className="grid g2">
                {props.courses.map((course) => (
                  <Link key={course.slug} className="card course-chip" href={`/courses/${course.slug}`}>
                    <span className="cc-ic" aria-hidden="true">
                      {initials(course.subject)}
                    </span>
                    <div>
                      <div className="cn">{course.name}</div>
                      <div className="cs">
                        {course.subject} · {course.level}
                      </div>
                    </div>
                    <span className="go" aria-hidden="true">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* SCHOLARSHIPS */}
          {props.scholarships.length ? (
            <section className="section" id="scholarships">
              <div className="section-head row-between">
                <div>
                  <span className="eyebrow">Funding</span>
                  <h2>Scholarships by subject</h2>
                </div>
                <Link className="link-more" href="/scholarships">
                  All scholarships →
                </Link>
              </div>
              <div className="grid g3">
                {props.scholarships.map((scholarship) => (
                  <article className="card sch" key={scholarship.slug}>
                    {scholarship.type ? <span className="s-cat">{scholarship.type}</span> : null}
                    <h3>
                      <Link href={`/scholarships/${scholarship.slug}`}>{scholarship.title}</Link>
                    </h3>
                    {scholarship.amount ? <div className="s-amt">{scholarship.amount}</div> : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {/* WHY */}
          <section className="section" id="why">
            <div className="section-head">
              <span className="eyebrow">Why Universta</span>
              <h2>Why browse by subject</h2>
            </div>
            <div className="why5">
              {WHY.map((item) => (
                <div className="card why-card" key={item.h}>
                  <h3>{item.h}</h3>
                  <p>{item.p}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="section" id="faq">
            <div className="section-head">
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

          {/* EXPLORE */}
          <section className="section" id="explore">
            <div className="section-head">
              <span className="eyebrow">Keep exploring</span>
              <h2>Explore more of Universta</h2>
            </div>
            <div className="explore-grid">
              {[
                ['Study destinations', '/countries'],
                ['Universities', '/universities'],
                ['Courses', '/courses'],
                ['Scholarships', '/scholarships'],
                ['Consultants', '/study-abroad-consultants'],
                ['Free counselling', '/counselling'],
              ].map(([label, href]) => (
                <Link className="card explore-item" key={href} href={href}>
                  <span className="en">{label}</span>
                  <span className="go" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </main>

        <aside className="side">
          <div className="side-card">
            <h3>Not sure which subject fits?</h3>
            <p>Talk it through with a counsellor before you shortlist courses.</p>
            <Link className="btn btn-primary btn-block" href="/counselling">
              Book free counselling
            </Link>
          </div>
          <div className="side-card">
            <h3>Jump to</h3>
            <div className="side-links">
              <a href="#popular">Popular subjects</a>
              <a href="#all">All subjects A–Z</a>
              <a href="#degrees">Degree levels</a>
              <a href="#destinations">Destinations</a>
              <a href="#scholarships">Scholarships</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

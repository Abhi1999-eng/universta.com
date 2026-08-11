'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatDate, formatNumber } from '@/lib/format';

/** The client-approved university course catalogue.
 *
 * The template is written around a sample University of Toronto page with 18
 * faculties, admission tables, career outcomes, industry partners, student
 * reviews and a resources rail. An offering record holds its course, level,
 * study mode, campus, duration, tuition and intakes — so those blocks render
 * and the rest are dropped rather than invented.
 *
 * Every facet in the rail maps to a parameter the offerings endpoint honours
 * (degree level, study mode, intake, scholarships), and the options are
 * derived from this university's own published offerings, so a facet never
 * offers a value that returns nothing. */

export type OfferingRow = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  courseName: string | null;
  subject: string | null;
  subSubject: string | null;
  level: string | null;
  levelCode: string | null;
  studyMode: string | null;
  campus: string | null;
  duration: string | null;
  tuition: string | null;
  intakes: Array<{ label: string; deadline: string | null }>;
};

export type UniversityCoursesReferenceProps = {
  university: { name: string; slug: string };
  rows: OfferingRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  filters: Record<string, string>;
  facets: {
    levels: Array<{ value: string; label: string; count: number }>;
    studyModes: Array<{ value: string; label: string; count: number }>;
    intakes: Array<{ value: string; label: string; count: number }>;
    subjects: Array<{ value: string; label: string; count: number }>;
    campuses: string[];
  };
  deadlines: Array<{ label: string; deadline: string | null }>;
  scholarships: Array<{ title: string; slug: string; amount: string | null }>;
  totalOfferings: number;
};

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

const FAQS = [
  {
    q: 'Are these all the programmes this university offers?',
    a: 'They are every programme Universta has published for it. A university may run more; where a programme is missing, it has not been added to the catalogue yet.',
  },
  {
    q: 'Is the tuition figure final?',
    a: 'No. It is the published range for international students at the time the record was verified. Confirm the exact fee with the university before you apply.',
  },
  {
    q: 'What does the intake deadline mean?',
    a: 'It is the application deadline recorded against that intake for this specific programme. Deadlines differ by programme, so check the one you are applying to.',
  },
];

export function UniversityCoursesReference(props: UniversityCoursesReferenceProps) {
  const { university, rows, meta, filters, facets } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function commit(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');
    setDrawerOpen(false);
    router.push(`${pathname}${params.size ? `?${params}` : ''}#all-programs`);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete('page');
    else params.set('page', String(page));
    return `${pathname}${params.size ? `?${params}` : ''}#all-programs`;
  }

  const activeCount = Object.keys(filters).filter((key) => key !== 'page').length;

  const groups = [
    { key: 'courseLevel', label: 'Degree level', options: facets.levels, open: true },
    { key: 'studyMode', label: 'Study mode', options: facets.studyModes, open: true },
    { key: 'intake', label: 'Intake', options: facets.intakes, open: false },
  ].filter((group) => group.options.length > 0);

  return (
    <div className="cref">
      <div className="wrap">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> › <Link href="/universities">Universities</Link> ›{' '}
          <Link href={`/universities/${university.slug}`}>{university.name}</Link> ›{' '}
          <span aria-current="page">Courses</span>
        </nav>
      </div>

      {/* HERO */}
      <section className="hero">
        <div className="wrap hero-in">
          <span className="hero-pill">
            <span className="dot" aria-hidden="true" />{' '}
            <b>{formatNumber(props.totalOfferings)}</b>&nbsp;published programmes
          </span>
          <h1 style={{ marginTop: 16 }}>
            Courses at <span className="b">{university.name}</span>
          </h1>
          <p className="lead">
            Every published programme at {university.name}, with its level, study mode, duration,
            tuition and intake deadlines.
          </p>
          <div className="hero-ctas">
            <a href="#all-programs" className="btn btn-primary btn-lg">
              Browse programmes
            </a>
            <Link href={`/universities/${university.slug}`} className="btn btn-outline btn-lg">
              University profile
            </Link>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>

          <div className="statgrid">
            <div className="stat">
              <b>{formatNumber(props.totalOfferings) || '—'}</b>
              <span>Programmes</span>
            </div>
            <div className="stat">
              <b>{facets.levels.length || '—'}</b>
              <span>Degree levels</span>
            </div>
            <div className="stat">
              <b>{facets.subjects.length || '—'}</b>
              <span>Subjects</span>
            </div>
            <div className="stat">
              <b>{facets.studyModes.length || '—'}</b>
              <span>Study modes</span>
            </div>
            <div className="stat">
              <b>{facets.campuses.length || '—'}</b>
              <span>Campuses</span>
            </div>
            <div className="stat">
              <b>{facets.intakes.length || '—'}</b>
              <span>Intakes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ALL PROGRAMMES */}
      <section className="sec wrap" id="all-programs" style={{ paddingTop: 24 }}>
        <div className="sec-head left">
          <span className="eyebrow">Discover → filter → apply</span>
          <h2>All programmes</h2>
          <p>Filter this university’s published catalogue by level, study mode and intake.</p>
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
            className={`filters${drawerOpen ? ' open' : ''}`}
            aria-label="Filter programmes"
            data-testid="offering-filters"
          >
            <div className="fhead">
              <h3>Filters</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {activeCount ? (
                  <Link
                    href={`/universities/${university.slug}/courses#all-programs`}
                    style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}
                  >
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

            <div className="fscroll">
              {groups.map((group) => (
                <details className="fgroup" key={group.key} open={group.open}>
                  <summary>
                    {group.label} <span className="caret">▾</span>
                  </summary>
                  <div className="opts">
                    {group.options.map((option) => {
                      const checked = filters[group.key] === option.value;
                      return (
                        <label className="opt" key={option.value}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => commit({ [group.key]: checked ? null : option.value })}
                          />
                          {option.label}
                          <span className="cnt">{option.count}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>

            <div className="ffoot">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => setDrawerOpen(false)}
              >
                Show {formatNumber(meta.total)} result{meta.total === 1 ? '' : 's'}
              </button>
            </div>
          </aside>

          <div>
            <div className="main-head">
              <button
                type="button"
                className="btn btn-ghost btn-sm filter-toggle"
                onClick={() => setDrawerOpen(true)}
              >
                ☰ Filters{activeCount ? ` (${activeCount})` : ''}
              </button>
              <p className="count" data-testid="offering-count">
                {formatNumber(meta.total)} programme{meta.total === 1 ? '' : 's'}{' '}
                <span>{activeCount ? 'match your filters' : 'published'}</span>
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="cref-empty" data-testid="offering-empty">
                <h3>No programmes match these filters</h3>
                <p>Clear a filter to see this university’s full published catalogue.</p>
                <Link
                  className="btn btn-primary"
                  href={`/universities/${university.slug}/courses#all-programs`}
                >
                  Clear filters
                </Link>
              </div>
            ) : (
              <div className="slist">
                {rows.map((row) => (
                  <article className="course" key={row.id}>
                    <div className="course-top">
                      <span className="uni-logo" aria-hidden="true">
                        {initials(row.subject ?? row.name)}
                      </span>
                      <div className="course-head">
                        <div className="course-badges">
                          {row.level ? <span className="badge badge-lvl">🎓 {row.level}</span> : null}
                          {row.studyMode ? (
                            <span className="badge badge-mode">{row.studyMode}</span>
                          ) : null}
                          {row.campus ? <span className="badge badge-mode">{row.campus}</span> : null}
                        </div>
                        <h3>
                          <Link href={`/universities/${university.slug}/courses/${row.slug}`}>
                            {row.name}
                          </Link>
                        </h3>
                        <div className="uni">
                          {row.subject ? <span className="cc">{row.subject}</span> : null}
                          {row.subSubject ? <span>· {row.subSubject}</span> : null}
                          {row.courseName && row.courseName !== row.name ? (
                            <span>· {row.courseName}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {row.duration || row.tuition || row.intakes.length ? (
                      <div className="course-facts">
                        {row.duration ? (
                          <div className="fact">
                            <div className="k">Duration</div>
                            <div className="v">{row.duration}</div>
                          </div>
                        ) : null}
                        {row.tuition ? (
                          <div className="fact">
                            <div className="k">Tuition</div>
                            <div className="v">{row.tuition}</div>
                          </div>
                        ) : null}
                        {row.intakes[0] ? (
                          <div className="fact">
                            <div className="k">Next intake</div>
                            <div className="v">{row.intakes[0].label}</div>
                          </div>
                        ) : null}
                        {row.intakes[0]?.deadline ? (
                          <div className="fact">
                            <div className="k">Apply by</div>
                            <div className="v">{formatDate(row.intakes[0].deadline)}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="course-foot">
                      <span className="spacer" />
                      <Link
                        href={`/universities/${university.slug}/courses/${row.slug}`}
                        className="btn btn-primary btn-sm"
                      >
                        View programme →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {meta.totalPages > 1 ? (
              <nav className="pager" aria-label="Pagination">
                {meta.page > 1 ? <Link href={pageHref(meta.page - 1)}>‹</Link> : <span>‹</span>}
                {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((page) => (
                  <Link
                    key={page}
                    href={pageHref(page)}
                    aria-current={page === meta.page ? 'page' : undefined}
                  >
                    {page}
                  </Link>
                ))}
                {meta.page < meta.totalPages ? (
                  <Link href={pageHref(meta.page + 1)}>›</Link>
                ) : (
                  <span>›</span>
                )}
              </nav>
            ) : null}
          </div>
        </div>
      </section>

      {/* BY DEGREE LEVEL */}
      {facets.levels.length ? (
        <section className="sec wrap" id="degrees">
          <div className="panel">
            <div className="sec-head left">
              <span className="eyebrow">By qualification</span>
              <h2>Browse by degree level</h2>
            </div>
            <div className="grid g4">
              {facets.levels.map((level) => (
                <Link
                  key={level.value}
                  className="card mini-card"
                  href={`/universities/${university.slug}/courses?courseLevel=${level.value}#all-programs`}
                >
                  <span className="mini-ic" aria-hidden="true">
                    {initials(level.label)}
                  </span>
                  <div>
                    <h3>{level.label}</h3>
                    <div className="mc-sub">
                      {level.count} programme{level.count === 1 ? '' : 's'}
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

      {/* BY SUBJECT */}
      {facets.subjects.length ? (
        <section className="sec wrap" id="subjects">
          <div className="sec-head left">
            <span className="eyebrow">By subject</span>
            <h2>Browse by subject</h2>
            <p>Subject areas this university publishes programmes in.</p>
          </div>
          <div className="grid g4">
            {facets.subjects.map((subject) => (
              <Link
                key={subject.value}
                className="card mini-card"
                href={`/subjects/${subject.value}`}
              >
                <span className="mini-ic" aria-hidden="true">
                  {initials(subject.label)}
                </span>
                <div>
                  <h3>{subject.label}</h3>
                  <div className="mc-sub">
                    {subject.count} programme{subject.count === 1 ? '' : 's'}
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

      {/* INTAKES */}
      {props.deadlines.length ? (
        <section className="sec wrap" id="intakes">
          <div className="panel">
            <div className="sec-head left">
              <span className="eyebrow">Timeline</span>
              <h2>Intakes and deadlines</h2>
              <p>Application deadlines recorded against this university’s programmes.</p>
            </div>
            <div className="grid g3">
              {props.deadlines.map((entry) => (
                <div className="card mini-card" key={`${entry.label}-${entry.deadline ?? ''}`}>
                  <div>
                    <h3>{entry.label}</h3>
                    <div className="mc-sub">
                      {entry.deadline ? `Apply by ${formatDate(entry.deadline)}` : 'Deadline not published'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* SCHOLARSHIPS */}
      {props.scholarships.length ? (
        <section className="sec wrap" id="scholarships">
          <div className="sec-head left row-between">
            <div>
              <span className="eyebrow">Funding</span>
              <h2>Scholarships at {university.name}</h2>
            </div>
            <Link className="link-more" href="/scholarships">
              All scholarships →
            </Link>
          </div>
          <div className="grid g3">
            {props.scholarships.map((scholarship) => (
              <Link
                key={scholarship.slug}
                className="card mini-card"
                href={`/scholarships/${scholarship.slug}`}
              >
                <div>
                  <h3>{scholarship.title}</h3>
                  {scholarship.amount ? <div className="mc-sub">{scholarship.amount}</div> : null}
                </div>
                <span className="go" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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

      {/* CTA */}
      <section className="sec wrap">
        <div className="final-cta">
          <h2>Shortlist your {university.name} programmes</h2>
          <p>
            Compare programmes on tuition, duration and intake, then talk your shortlist through
            with a counsellor before you apply.
          </p>
          <div className="hero-ctas">
            <a href="#all-programs" className="btn btn-secondary btn-lg">
              Browse programmes
            </a>
            <Link href="/counselling" className="btn btn-outline btn-lg">
              Book free counselling
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

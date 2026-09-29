'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Subject, SubSubject } from '@/lib/catalog';

export type SubjectIndexRow = Subject & {
  subSubjects?: SubSubject[];
  publishedSubSubjectCount?: number;
};

/**
 * The subject explorer, in the reference's own markup.
 *
 * One search box filters subjects and their specializations together, because
 * that is how people look for a field: nobody types "Agriculture &
 * Environmental Sciences" on the way to "Viticulture". A card survives when
 * either its own name or one of its branches matches, and the branches it
 * shows narrow to the matches so the reason it survived is visible.
 *
 * The reference also carries a study-level filter across the top. That reads
 * `studyLevels` off each specialization, which is a field the taxonomy we
 * were given does not have, so the bar is left out rather than shipped inert.
 */
export function SubjectIndex({ subjects }: { subjects: SubjectIndexRow[] }) {
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!needle) {
      return subjects.map((subject) => ({ subject, specs: subject.subSubjects ?? [] }));
    }
    return subjects
      .map((subject) => {
        const specs = (subject.subSubjects ?? []).filter((spec) =>
          spec.name.toLowerCase().includes(needle),
        );
        const self = subject.name.toLowerCase().includes(needle);
        if (!self && specs.length === 0) return null;
        /* A subject matched by its own name keeps its full list; one matched
           through a branch shows only the branches that matched. */
        return { subject, specs: self ? (subject.subSubjects ?? []) : specs };
      })
      .filter(Boolean) as Array<{ subject: SubjectIndexRow; specs: SubSubject[] }>;
  }, [subjects, needle]);

  const examples = ['Computer Science', 'Artificial Intelligence', 'Engineering', 'Law'];

  return (
    <>
      <section className="hero hero--compact">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Subjects</span>
          </nav>
          <div className="hero__lead">
            <p className="hero__eyebrow">
              Find your field<b>·</b>
              {subjects.length} subjects
            </p>
            <h1 className="hero__h1">What do you want to study?</h1>
            <p className="hero__sub">
              Explore subjects and specializations, then discover study pathways
              available in your destination.
            </p>
          </div>
          <div className="bigsearch">
            <svg
              width="20"
              height="20"
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
              placeholder="Search subjects or specializations"
              aria-label="Search subjects or specializations"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Link className="btn btn--sm" href="/specializations">
              All specializations{' '}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
          <p className="bigsearch__ex">
            <span className="label">Try</span>
            {examples.map((example) => (
              <button
                key={example}
                className="chipbtn chipbtn--sm"
                type="button"
                onClick={() => setQuery(example)}
              >
                {example}
              </button>
            ))}
          </p>
        </div>
      </section>

      <section className="sec sec--white" id="taxonomy">
        <div className="wrap">
          {rows.length === 0 ? (
            <p className="sec-lead">No subjects match “{query.trim()}”.</p>
          ) : null}
          <div className="subjindex">
            {rows.map(({ subject, specs }) => (
              <article className="subjcard" key={subject.id}>
                <div className="subjcard__head">
                  <span className="subjcard__icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 5h16v14H4z M4 9h16" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="subjcard__name">
                      <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
                    </h2>
                    <p className="subjcard__meta">
                      {subject.publishedSubSubjectCount ??
                        (subject.subSubjects ?? []).length}{' '}
                      specializations
                    </p>
                  </div>
                  {subject.featured ? (
                    <span className="badge badge--req">Popular</span>
                  ) : null}
                </div>
                {subject.shortDescription ? (
                  <p className="subjcard__desc">{subject.shortDescription}</p>
                ) : null}
                {specs.length ? (
                  <div className="subjcard__specs">
                    {specs.slice(0, 8).map((spec) => (
                      <Link
                        key={spec.id}
                        className="specpill"
                        href={`/subjects/${subject.slug}/${spec.slug}`}
                      >
                        {spec.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="subjcard__foot">
                  <Link className="linkcta" href={`/subjects/${subject.slug}`}>
                    Explore {subject.name}{' '}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

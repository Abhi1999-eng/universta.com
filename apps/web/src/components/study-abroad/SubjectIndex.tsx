'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Subject, SubSubject } from '@/lib/catalog';
import { SearchCombobox } from '@/components/reference/SearchCombobox';

export type SubjectIndexRow = Subject & {
  subSubjects?: SubSubject[];
  publishedSubSubjectCount?: number;
  publishedCourseCount?: number;
  levels?: Array<{ code: string; name: string }>;
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
  const router = useRouter();
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [level, setLevel] = useState('all');

  /* The field follows the URL, so a shared link, a refresh and the back
     button all land on the same filtered page rather than an empty one.
     Adjusted during render rather than in an effect: an effect would paint
     the stale term first and then correct it. */
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  if (seenUrlQuery !== urlQuery) {
    setSeenUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const commit = (term: string) => {
    const next = new URLSearchParams(params.toString());
    if (term.trim()) next.set('q', term.trim());
    else next.delete('q');
    const search = next.toString();
    router.push(search ? `/subjects?${search}` : '/subjects');
  };

  /* The filter offers only the levels the catalogue actually teaches, so it
     never shows a button that can empty the page. */
  const levels = useMemo(() => {
    const seen = new Map<string, string>();
    for (const subject of subjects)
      for (const entry of subject.levels ?? [])
        if (!seen.has(entry.code)) seen.set(entry.code, entry.name);
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }, [subjects]);

  const needle = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const atLevel = (subject: SubjectIndexRow) =>
      level === 'all' ||
      (subject.levels ?? []).some((entry) => entry.code === level);
    if (!needle) {
      return subjects
        .filter(atLevel)
        .map((subject) => ({ subject, specs: subject.subSubjects ?? [] }));
    }
    return subjects
      .filter(atLevel)
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
  }, [subjects, needle, level]);

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
            <SearchCombobox
              label="Search subjects"
              placeholder="Search subjects or specializations"
              submitLabel="Search"
              endpoint="/api/subjects/suggestions"
              emptyMessage="No subjects found."
              value={query}
              onValueChange={setQuery}
              onSubmit={commit}
            />
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
          {levels.length > 1 ? (
            <div
              className="levelbar levelbar--wide"
              role="group"
              aria-label="Study level"
            >
              <span className="filters__label">Study level</span>
              <button
                className="chipbtn"
                type="button"
                aria-pressed={level === 'all'}
                onClick={() => setLevel('all')}
              >
                All
              </button>
              {levels.map((entry) => (
                <button
                  key={entry.code}
                  className="chipbtn"
                  type="button"
                  aria-pressed={level === entry.code}
                  onClick={() => setLevel(entry.code)}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
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
                    <span className="linkcta__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                  <span className="subjcard__count datum">
                    {subject.publishedCourseCount ?? 0} programmes profiled
                  </span>
                </div>
              </article>
            ))}
          </div>
          <p className="trust__note">
            Programme counts come from universities published in this
            catalogue, not from the whole sector. A subject with no count is
            one we have not yet profiled a programme for.
          </p>
        </div>
      </section>
    </>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Subject, SubSubject } from '@/lib/catalog';
import { mergeLevels, sortByLevelOrder } from '@/lib/level-order';
import { matchCount, searchSubjectIndex } from '@/lib/subject-index-search';
import { SubjectIndexSearch } from './SubjectIndexSearch';

/** Where the cards begin: the search brings it into view. */
const RESULTS_ID = 'taxonomy';

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
 * The reference also carries a study-level filter across the top. It is
 * built from the levels each subject's published courses are taught at, in
 * the order a student climbs them (`levelOrder`, the public course-levels
 * list); merged in the order they were met, it opened on PhD.
 */
/** "Explore Arts, Humanities & Social " -- all but the name's last word. */
function lead(name: string) {
  const words = `Explore ${name}`.trim().split(/\s+/);
  return `${words.slice(0, -1).join(' ')} `;
}

/** "Sciences" -- the word the arrow stays with. */
function lastWord(name: string) {
  return `Explore ${name}`.trim().split(/\s+/).pop() ?? '';
}

export function SubjectIndex({
  subjects,
  levelOrder = [],
}: {
  subjects: SubjectIndexRow[];
  /** Level codes in academic order. */
  levelOrder?: string[];
}) {
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
    const target = search ? `/subjects?${search}` : '/subjects';
    /* Clearing a term that never reached the address changes nothing
       there, so it is not a step for the back button. */
    if (next.toString() !== params.toString()) router.push(target);
  };

  /* The filter offers only the levels the catalogue actually teaches, so it
     never shows a button that can empty the page. */
  const levels = useMemo(
    () => mergeLevels(subjects.map((subject) => subject.levels), levelOrder),
    [subjects, levelOrder],
  );

  /* The level narrows the subjects first; the search then reads what is
     left, so the count above the grid is the count of what is shown. */
  const atLevel = useMemo(
    () =>
      subjects.filter(
        (subject) =>
          level === 'all' ||
          (subject.levels ?? []).some((entry) => entry.code === level),
      ),
    [subjects, level],
  );
  const result = useMemo(() => searchSubjectIndex(atLevel, query), [atLevel, query]);
  const rows = result.rows as Array<{ subject: SubjectIndexRow; specs: SubSubject[] }>;

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
          <SubjectIndexSearch
            query={query}
            onQueryChange={setQuery}
            onCommit={commit}
            result={result}
            resultsId={RESULTS_ID}
          />
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

      <section className="sec sec--white" id={RESULTS_ID}>
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
          {/* The reference heads a search's answer with the term, how many
              things answered and the way back to everything. */}
          {result.searching ? (
            <div className="subjres">
              <p className="subjres__t" aria-live="polite">
                Results for “{query.trim()}”{' '}
                <span className="h-count__n">{matchCount(result.matches)}</span>
              </p>
              <Link
                className="linkcta"
                href="/subjects"
                onClick={() => setQuery('')}
              >
                All subjects{' '}
                <span className="linkcta__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          ) : null}
          {rows.length === 0 && result.searching ? (
            <p className="sec-lead">No subjects match “{query.trim()}”.</p>
          ) : null}
          <div className="subjindex">
            {rows.map(({ subject, specs }) => (
              <article className="subjcard" key={subject.id}>
                <div className="subjcard__head">
                  {/* The reference draws a different glyph per subject. Ours
                      are set per record in the Admin, so a subject with an
                      icon shows its own and the rest keep the generic mark
                      rather than all thirty looking alike by accident. */}
                  <span className="subjcard__icon" aria-hidden="true">
                    {subject.iconMedia ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={subject.iconMedia.url} alt="" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M4 5h16v14H4z M4 9h16" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <h2 className="subjcard__name">
                      <Link href={`/subjects/${subject.slug}`}>{subject.name}</Link>
                    </h2>
                    {/* The reference states the branches and the levels they
                        are taught at on one line; the levels half is dropped
                        rather than left dangling when none are recorded. */}
                    <p className="subjcard__meta">
                      {subject.publishedSubSubjectCount ??
                        (subject.subSubjects ?? []).length}{' '}
                      specializations
                      {subject.levels?.length ? (
                        <>
                          {' · '}
                          {/* A summary, not an inventory: our level names are
                              full titles ("Post Graduate Diploma in
                              Management"), and five of them turned this line
                              into a paragraph. */}
                          {sortByLevelOrder(subject.levels, levelOrder)
                            .slice(0, 3)
                            .map((entry) => entry.name)
                            .join(', ')}
                          {subject.levels.length > 3
                            ? ` +${subject.levels.length - 3}`
                            : ''}
                        </>
                      ) : null}
                    </p>
                  </div>
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
                    {/* The last word and the arrow are held together, so
                        the arrow goes onto the next line with that word and
                        never by itself. A no-break space was not enough: a
                        browser still breaks before an inline block. */}
                    {lead(subject.name)}
                    <span className="linkcta__end">
                      {lastWord(subject.name)}{'\u00a0'}
                      <span className="linkcta__arrow" aria-hidden="true">
                        →
                      </span>
                    </span>
                  </Link>
                  {/* No figure for a subject with none, as the note under the
                      grid promises and the design does: "0 programmes
                      profiled" reads as a fact about the subject. */}
                  {subject.publishedCourseCount ? (
                    <span className="subjcard__count datum">
                      {subject.publishedCourseCount} programmes profiled
                    </span>
                  ) : null}
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

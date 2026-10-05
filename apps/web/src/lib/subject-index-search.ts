import { isSearching, matchesSubject } from './subject-search';

/**
 * What the subjects explorer's search finds, worked out from the subjects
 * already on the page.
 *
 * The box used to ask the API for suggestions, and the API matches subject
 * names only: typing "software" kept the Computer Science card, with its
 * Software Engineering pill, while the box under the field said "No subjects
 * found." Everything the answer needs is on the page already, so the cards,
 * the suggestions and the count are all read from one place here and cannot
 * disagree.
 *
 * Matching is the country search's: every word typed has to begin a word of
 * the name. "ience" no longer finds seven subjects that merely contain it.
 */

type Branch = { id: string; name: string; slug: string };
type Searchable = {
  id: string;
  name: string;
  slug: string;
  subSubjects?: Branch[] | null;
};

export type SubjectIndexResult<T extends Searchable> = {
  /** The cards that stay, each with the pills it shows. */
  rows: Array<{ subject: T; specs: Branch[] }>;
  /** Subjects whose own name matched. */
  subjects: T[];
  /** Specializations whose name matched, with the subject they sit under. */
  specializations: Array<{ spec: Branch; subject: T }>;
  /** What the count above the grid says: every subject and every
   *  specialization that answered, as the reference counts its matches. */
  matches: number;
  searching: boolean;
};

export function searchSubjectIndex<T extends Searchable>(
  subjects: readonly T[],
  query: string,
): SubjectIndexResult<T> {
  const searching = isSearching(query);
  if (!searching)
    return {
      rows: subjects.map((subject) => ({ subject, specs: subject.subSubjects ?? [] })),
      subjects: [],
      specializations: [],
      matches: 0,
      searching,
    };
  const rows: SubjectIndexResult<T>['rows'] = [];
  const named: T[] = [];
  const specializations: SubjectIndexResult<T>['specializations'] = [];
  for (const subject of subjects) {
    const branches = subject.subSubjects ?? [];
    const self = matchesSubject(subject.name, query);
    const hits = branches.filter((spec) => matchesSubject(spec.name, query));
    if (self) named.push(subject);
    for (const spec of hits) specializations.push({ spec, subject });
    if (!self && !hits.length) continue;
    /* A subject matched by its own name keeps its full list; one matched
       through a branch shows only the branches that matched, so the reason
       it stayed is the thing on screen. */
    rows.push({ subject, specs: self ? branches : hits });
  }
  return {
    rows,
    subjects: named,
    specializations,
    matches: named.length + specializations.length,
    searching,
  };
}

/** "1 match", "4 matches". */
export function matchCount(count: number): string {
  return `${count} ${count === 1 ? 'match' : 'matches'}`;
}

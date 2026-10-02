/**
 * The two orderings a destination's own listings depend on.
 *
 * Both are small, and both are the sort of thing that reads as obviously
 * right until somebody changes it to something else that also reads as
 * obviously right. They live here so the decision is written down once and
 * can be argued with.
 */

export type RankedUniversity = {
  name: string;
  qsRanking?: number | null;
};

/**
 * Ranked institutions first, in rank order, then the rest alphabetically.
 *
 * An unranked university is not in last place; it is unmeasured. Sorting
 * it as though it ranked worse than every ranked one would be inventing a
 * position for it, so they follow in their own order instead.
 */
export function rankedFirst<T extends RankedUniversity>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    if (left.qsRanking && right.qsRanking) return left.qsRanking - right.qsRanking;
    if (left.qsRanking) return -1;
    if (right.qsRanking) return 1;
    return left.name.localeCompare(right.name);
  });
}

export type SourcedSubject = { source?: string | null };

/**
 * Splits a destination's subjects by what put them there.
 *
 * A derived subject is on the page because a published course in it is
 * taught in this destination: open it and there is something behind it. An
 * editorial one is there because somebody added it, usually for a market
 * the catalogue has not caught up with, and may still be empty. Shown in
 * one undifferentiated grid, the second kind is how a reader lands on a
 * page with nothing on it.
 */
export function partitionSubjects<T extends SourcedSubject>(
  subjects: readonly T[],
): { taught: T[]; editorial: T[] } {
  return {
    taught: subjects.filter((subject) => subject.source !== 'EDITORIAL'),
    editorial: subjects.filter((subject) => subject.source === 'EDITORIAL'),
  };
}

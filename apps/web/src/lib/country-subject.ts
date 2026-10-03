/**
 * What a destination-and-subject page shows, and in what order.
 *
 * Small enough to inline and fiddly enough to get silently wrong, so it is
 * decided once here and tested rather than re-derived in each page.
 */

export type Specialization = {
  id: string;
  name: string;
  slug: string;
  publishedCourseCount?: number;
};

export type SubjectLink = { id: string; name: string; slug: string };

/**
 * Specializations with something published first, in descending count, then
 * the rest alphabetically.
 *
 * An empty specialization is not last because it is worse; it is last
 * because a reader clicking it finds nothing, and the ones that answer
 * should be the ones in reach. They stay on the page because the catalogue
 * covering a field unevenly is a fact about the catalogue, not a reason to
 * hide half a taxonomy.
 */
export function rankSpecializations<T extends Specialization>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((left, right) => {
    const a = left.publishedCourseCount ?? 0;
    const b = right.publishedCourseCount ?? 0;
    if (a !== b) return b - a;
    return left.name.localeCompare(right.name);
  });
}

export function countrySubjectPage<
  S extends Specialization,
  O extends SubjectLink,
>(input: {
  specializations: readonly S[];
  others: readonly O[];
  subjectSlug: string;
}): { specializations: S[]; others: O[] } {
  return {
    specializations: rankSpecializations(input.specializations),
    /* The subject being read is not one of the others, however the
       destination happens to have it listed. */
    others: input.others
      .filter((entry) => entry.slug !== input.subjectSlug)
      .slice(0, 8),
  };
}

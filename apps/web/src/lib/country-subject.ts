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

/**
 * Which subjects a destination's page shows, and whether they are its own.
 *
 * The links are derived from the courses published in a destination, so a
 * destination with no courses had no subjects and the page said so and
 * stopped. But the taxonomy is not per-country: the fields Universta knows
 * are the same everywhere, and what varies is which of them have programmes
 * behind them here. Falling back to the catalogue is what keeps a new
 * destination from being a dead end, and `listed` is how the page knows to
 * say the list is the catalogue's rather than its own.
 */
export function subjectsForCountry<T extends SubjectLink>(input: {
  linked: readonly T[];
  catalogue: readonly T[];
}): { subjects: T[]; listed: boolean } {
  return input.linked.length
    ? { subjects: [...input.linked], listed: true }
    : { subjects: [...input.catalogue], listed: false };
}

/**
 * The subjects next to this one: the ones that teach a specialization of the
 * same name.
 *
 * The reference closes a subject's page with "Related subjects -- subjects
 * that share specializations with this one", and its length follows the
 * data: Energy, Oil & Gas shows Engineering alone. The taxonomy files the
 * same branch under several subjects ("Digital Management" sits under five),
 * so the shared names are what make two subjects neighbours. Ranked by how
 * many they share, then by name; a subject sharing none is not related.
 */

type Branch = { name: string };
type SubjectWithBranches = {
  id: string;
  name: string;
  slug: string;
  subSubjects?: Branch[] | null;
};

export const RELATED_SUBJECTS_SHOWN = 6;

/** "Data & Analytics" and "data and analytics" are the same branch. */
function branchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function relatedSubjects<T extends SubjectWithBranches>(
  subject: Pick<SubjectWithBranches, 'id'> & { subSubjects?: Branch[] | null },
  all: readonly T[],
  limit = RELATED_SUBJECTS_SHOWN,
): Array<T & { shared: number }> {
  const mine = new Set((subject.subSubjects ?? []).map((row) => branchKey(row.name)));
  if (!mine.size) return [];
  return all
    .filter((other) => other.id !== subject.id)
    .map((other) => ({
      ...other,
      shared: new Set(
        (other.subSubjects ?? [])
          .map((row) => branchKey(row.name))
          .filter((key) => mine.has(key)),
      ).size,
    }))
    .filter((other) => other.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.name.localeCompare(b.name))
    .slice(0, limit);
}

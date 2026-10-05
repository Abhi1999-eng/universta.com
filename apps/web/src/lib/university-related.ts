import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import type { RelatedGroup } from '@/components/study-abroad/DiscoveryBands';
import { phaseList } from '@/lib/phase1';
import { listHref, rankedThenName, toUniversityListRow } from '@/lib/university-list';
import { countryUniversitiesHref, universityHref } from '@/lib/university-links';

/** How many universities a "Related on Universta" group names. */
const RELATED_SHOWN = 6;

/** A destination's list of universities, opened on the ones that teach one
 * subject -- the whole of what a subject's universities group names only
 * the first six of. The list reads `subject` from its address. */
export function subjectUniversitiesHref(countrySlug: string, subjectSlug: string) {
  return listHref(countryUniversitiesHref(countrySlug), { subjects: [subjectSlug] });
}

/**
 * The universities that teach a subject in one destination, as a
 * "Related on Universta" group.
 *
 * A subject's page in a country linked to the country's list of
 * universities and never to a university, so the reader who had chosen
 * both the field and the place still had to find the institutions
 * themselves. These are the ones with a published programme in the
 * subject there, ranked first and then A to Z -- the lists' own order.
 * A failed read costs the group, not the page: the band leaves out a
 * group with nothing in it.
 *
 * The group names six, so its count is the list's own total rather than
 * the six: "Universities in the United Kingdom 6" stood over a subject ten
 * UK universities teach, and its title read as every university there.
 */
export async function subjectUniversitiesGroup(
  countrySlug: string,
  subject: { slug: string; name: string },
  where: string,
): Promise<RelatedGroup> {
  const { rows, total } = await phaseList<AnyRecord>('universities', {
    country: countrySlug,
    subject: subject.slug,
    sort: 'ranking',
    limit: String(RELATED_SHOWN),
  })
    .then((result) => {
      const rows = result.data.map(toUniversityListRow);
      const counted = Number((result.meta as { total?: unknown } | null)?.total);
      /* Never fewer than are named: a missing or short total from an older
         API would otherwise print a count below the list under it. */
      return {
        rows,
        total: Number.isFinite(counted) ? Math.max(counted, rows.length) : rows.length,
      };
    })
    .catch(() => ({ rows: [], total: 0 }));
  return {
    title: `Universities teaching ${subject.name} in ${where}`,
    total,
    items: [...rows].sort(rankedThenName).map((row) => ({
      id: row.id,
      name: row.name,
      href: universityHref(row.slug),
    })),
  };
}

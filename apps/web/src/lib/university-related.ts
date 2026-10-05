import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import type { RelatedGroup } from '@/components/study-abroad/DiscoveryBands';
import { phaseList } from '@/lib/phase1';
import { rankedThenName, toUniversityListRow } from '@/lib/university-list';
import { universityHref } from '@/lib/university-links';

/** How many universities a "Related on Universta" group names. */
const RELATED_SHOWN = 6;

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
 */
export async function subjectUniversitiesGroup(
  countrySlug: string,
  subjectSlug: string,
  where: string,
): Promise<RelatedGroup> {
  const rows = await phaseList<AnyRecord>('universities', {
    country: countrySlug,
    subject: subjectSlug,
    sort: 'ranking',
    limit: String(RELATED_SHOWN),
  })
    .then((result) => result.data.map(toUniversityListRow))
    .catch(() => []);
  return {
    title: `Universities in ${where}`,
    items: [...rows].sort(rankedThenName).map((row) => ({
      id: row.id,
      name: row.name,
      href: universityHref(row.slug),
    })),
  };
}

import type { Metadata } from 'next';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { phaseListAll } from '@/lib/phase1';
import { UniversityIndex } from '@/components/study-abroad/UniversityIndex';
import {
  UniversityIndexHero,
  type DirectoryDestination,
} from '@/components/study-abroad/UniversityIndexHero';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';
import { isNarrowedList, toUniversityListRow } from '@/lib/university-list';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/* A searched, filtered or further-loaded view is a slice of this page, which
   is indexed in full under its bare address. The slice is left out of the
   index and its links are still followed -- the behaviour reference does
   the same with its own filtered lists, and like it the slice names no
   canonical, because "this is a copy of /universities" and "do not index
   this" are two different instructions and a crawler should get one. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const narrowed = isNarrowedList(await searchParams);
  return {
    title: 'Universities',
    description:
      'Every published institution in the Universta catalogue, by destination and type, with the programmes each one offers.',
    ...(narrowed
      ? { robots: { index: false, follow: true } }
      : { alternates: { canonical: '/universities' } }),
  };
}

export default async function UniversitiesPage() {
  /* The directory narrows in the browser, so it wants every institution:
     the counts beside each filter are then true, and the reader pays for
     one request rather than one per filter.

     That stopped being affordable at 9,761 universities. `phaseListAll`
     reads at most forty pages of fifty, so what arrives here is the first
     two thousand -- and the hero is told the catalogue's real size rather
     than the size of what was read, because presenting a ceiling as a
     total is how this page came to claim nothing was published at all.

     Read in the order the list opens in -- ranked first, then A to Z -- so
     whatever the cap leaves out is the end of the alphabet, never a ranked
     university the page is meant to lead with. */
  const read = await phaseListAll<AnyRecord>('universities', {
    sort: 'ranking',
  }).catch(() => null);
  const universities = read ? read.data.map(toUniversityListRow) : [];
  const total = read?.truncated?.total ?? universities.length;

  const byCountry = new Map<string, DirectoryDestination>();
  for (const row of universities) {
    if (!row.country) continue;
    const entry = byCountry.get(row.country.slug) ?? { ...row.country, count: 0 };
    entry.count += 1;
    byCountry.set(row.country.slug, entry);
  }
  const destinations = [...byCountry.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);

  return (
    <>
      <UniversityIndexHero total={total} destinations={destinations} />

      <UniversityIndex universities={universities} />

      <MatchBand heading="Know where you want to study?" href="/courses" />

      <PlanBand
        heading="Not sure which institution fits?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        secondary={{ href: '/study-abroad', label: 'Compare destinations' }}
      />

      <ConnectBand
        actions={[
          { href: '/courses', label: 'Explore courses' },
          { href: '/subjects', label: 'Browse subjects', ghost: true },
          { href: '/study-abroad', label: 'All destinations', ghost: true },
        ]}
        groups={[
          {
            title: 'Destinations',
            items: destinations.slice(0, 6).map((entry) => ({
              id: entry.slug,
              name: entry.name,
              href: `/study-abroad/${entry.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}

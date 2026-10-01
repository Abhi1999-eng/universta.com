import type { Metadata } from 'next';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { phaseListAll } from '@/lib/phase1';
import {
  UniversityIndex,
  type UniversityIndexRow,
} from '@/components/study-abroad/UniversityIndex';
import {
  UniversityIndexHero,
  type DirectoryDestination,
} from '@/components/study-abroad/UniversityIndexHero';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Universities',
  description:
    'Every published institution in the Universta catalogue, by destination and type, with the programmes each one offers.',
  alternates: { canonical: '/universities' },
};

/** The list endpoint carries the campus rows and the offering count under
 * names the shared record shape does not declare. */
function toRow(row: AnyRecord): UniversityIndexRow {
  const extra = row as Record<string, unknown>;
  const counts = extra._count as { offerings?: number } | undefined;
  const campuses = extra.campuses as unknown[] | undefined;
  const country = row.country as Record<string, unknown> | undefined;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription:
      typeof row.shortDescription === 'string' ? row.shortDescription : null,
    institutionType:
      typeof extra.institutionType === 'string' ? extra.institutionType : null,
    qsRanking: typeof extra.qsRanking === 'number' ? extra.qsRanking : null,
    programmes: counts?.offerings ?? 0,
    campuses: Array.isArray(campuses) ? campuses.length : 0,
    country: country?.name
      ? {
          name: String(country.name),
          slug: String(country.slug ?? ''),
          iso2Code:
            typeof country.iso2Code === 'string' ? country.iso2Code : null,
        }
      : null,
  };
}

export default async function UniversitiesPage() {
  /* Every published institution, because the directory narrows in the
     browser: the counts beside each filter are then true, and the reader
     pays for one request rather than one per filter. */
  const universities = await phaseListAll<AnyRecord>('universities')
    .then((result) => result.data.map(toRow))
    .catch(() => [] as UniversityIndexRow[]);

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
      <UniversityIndexHero
        total={universities.length}
        destinations={destinations}
      />

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

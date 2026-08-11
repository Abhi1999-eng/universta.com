import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import {
  UniversityCompareReference,
  type CompareUniversity,
} from '@/components/reference/UniversityCompareReference';
import { phaseCompare, phaseComparisonOptions } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return staticPageMetadata(
    'compare-universities',
    'Compare universities',
    'Compare published university tuition, campuses and course offerings side by side.',
    '/compare/universities',
    false,
  );
}

type Comparison = { items: AnyRecord[]; invalid: string[] };

function toItem(record: AnyRecord): CompareUniversity {
  const row = record as unknown as Record<string, unknown>;
  const counts = row._count as { offerings?: number } | undefined;
  const campuses = row.campuses as unknown[] | undefined;
  const accreditations = row.accreditations as Array<Record<string, unknown>> | undefined;
  const country = row.country as Record<string, unknown> | undefined;
  return {
    name: String(row.name),
    slug: String(row.slug),
    country: country?.name ? String(country.name) : null,
    institutionType: typeof row.institutionType === 'string' ? row.institutionType : null,
    shortDescription: typeof row.shortDescription === 'string' ? row.shortDescription : null,
    campuses: Array.isArray(campuses) ? campuses.length : 0,
    offerings: counts?.offerings ?? 0,
    accreditations: (accreditations ?? [])
      .map((entry) => (entry.name ? String(entry.name) : ''))
      .filter(Boolean),
    verifiedAt: typeof row.verifiedAt === 'string' ? row.verifiedAt : null,
    featured: row.isFeatured === true,
  };
}

export default async function CompareUniversities({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const items = ((await searchParams).items ?? '')
    .split(',')
    .filter(Boolean)
    .slice(0, 3);
  let result: Comparison = { items: [], invalid: [] };
  let options: { slug: string; name: string }[] = [];
  try {
    [result, options] = await Promise.all([
      phaseCompare<Comparison>('universities', items),
      phaseComparisonOptions<{ slug: string; name: string }>('universities'),
    ]);
  } catch {
    // Leaves the empty state rendered rather than failing the route.
  }

  return (
    <UniversityCompareReference
      items={result.items.map(toItem)}
      invalid={result.invalid}
      options={options}
      selected={items}
    />
  );
}

import { getListingPageContent } from '@/lib/listing-page-content';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import {
  UniversitiesReference,
  type UniversityRow,
} from '@/components/reference/UniversitiesReference';
import { getContinents, getCountries } from '@/lib/countries';
import { getCourseLevels, getSubjects } from '@/lib/catalog';
import { phaseList } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return staticPageMetadata(
    'universities-listing',
    'Universities',
    'Explore currently published universities and their study options.',
    '/universities',
  );
}

/** Only the keys the universities list endpoint actually honours. Anything
 * else in the URL is ignored rather than silently passed through. */
const SUPPORTED = ['q', 'country', 'type', 'subject', 'city', 'state', 'sort', 'page'] as const;

/** The record carries its campus list and offering count under names the
 * shared AnyRecord shape does not declare. */
function toRow(row: AnyRecord): UniversityRow {
  const extra = row as Record<string, unknown>;
  const counts = extra._count as { offerings?: number } | undefined;
  const campuses = extra.campuses as unknown[] | undefined;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    shortDescription: typeof row.shortDescription === 'string' ? row.shortDescription : null,
    country: row.country?.name
      ? {
          name: String(row.country.name),
          slug: String((row.country as Record<string, unknown>).slug ?? ''),
        }
      : null,
    institutionType: typeof row.institutionType === 'string' ? row.institutionType : null,
    offerings: counts?.offerings ?? 0,
    campuses: Array.isArray(campuses) ? campuses.length : 0,
    featured: extra.isFeatured === true,
    verified: row.verificationStatus === 'VERIFIED' || Boolean(extra.verifiedAt),
  };
}

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    SUPPORTED.flatMap((key) => {
      const value = raw[key];
      return typeof value === 'string' && value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;

  let rows: UniversityRow[] = [];
  let meta = { page: 1, limit: 12, total: 0, totalPages: 0 };
  let countries: Array<{ name: string; slug: string }> = [];
  let subjects: Array<{ name: string; slug: string }> = [];
  let continents: Array<{ name: string; slug: string }> = [];
  let levels: Array<{ name: string; code: string }> = [];
  let directory: Array<{ name: string; slug: string; country: string | null; offerings: number }> =
    [];
  let institutionTypes: string[] = [];

  try {
    const [result, countryList, subjectList, continentList, levelList, all] = await Promise.all([
      phaseList<AnyRecord>('universities', { limit: '12', ...filters }),
      getCountries({ limit: '100' })
        .then((r) => r.data)
        .catch(() => []),
      getSubjects({ limit: '100' })
        .then((r) => r.data)
        .catch(() => []),
      getContinents().catch(() => []),
      getCourseLevels().catch(() => []),
      // Unfiltered, for the A–Z index and the per-destination counts.
      phaseList<AnyRecord>('universities', { limit: '100' })
        .then((r) => r.data)
        .catch(() => []),
    ]);
    rows = result.data.map(toRow);
    meta = result.meta as typeof meta;
    countries = countryList.map((c) => ({ name: c.name, slug: c.slug }));
    subjects = subjectList.map((s) => ({ name: s.name, slug: s.slug }));
    continents = continentList
      .filter((item) => item.status === 'ACTIVE')
      .map(({ name, slug }) => ({ name, slug }));
    levels = levelList.map((l) => ({ name: l.name, code: l.code }));
    const mappedAll = all.map(toRow);
    directory = mappedAll.map((mapped) => ({
      name: mapped.name,
      slug: mapped.slug,
      country: mapped.country?.name ?? null,
      offerings: mapped.offerings,
    }));
    // Derived from the whole directory, not just page one, so the facet does
    // not lose an option as you page through.
    institutionTypes = [
      ...new Set(mappedAll.map((row) => row.institutionType).filter(Boolean)),
    ] as string[];
  } catch {
    // Leaves the honest empty state rendered rather than failing the route.
  }

  // Editorial framing from the managed "universities-listing" Page. Rows are
  // untouched -- they always come from the real records.
  const managed = await getListingPageContent('universities-listing');

  return (
    <UniversitiesReference
      rows={rows}
      meta={meta}
      filters={filters}
      countries={countries}
      subjects={subjects}
      continents={continents}
      levels={levels}
      institutionTypes={institutionTypes}
      directory={directory}
      heading={managed.heading ?? 'Find the best universities around the'}
      headingAccent={managed.heading ? '' : 'world'}
      lede={
        managed.lede ??
        'Explore published universities, then narrow the catalogue by destination, subject and location.'
      }
      ctaHeading={managed.ctaHeading ?? 'Not sure which university fits?'}
      ctaBody={
        managed.ctaBody ?? 'Talk through your shortlist with a counsellor before you apply.'
      }
    />
  );
}

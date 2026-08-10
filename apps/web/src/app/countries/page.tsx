import Link from 'next/link';
import { CountriesReference, type SectionCopy } from '@/components/reference/CountriesReference';
import { getContinents, getCountries, getDirectory } from '@/lib/countries';
import { phaseList, phasePage } from '@/lib/phase1';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { staticPageMetadata } from '@/lib/static-page-seo';

/** The Study Destinations listing. Section keys an admin can use, via the
 * generic Page CMS (Phase 1 content -> Pages -> a page with slug "countries"),
 * to override this listing's hero and editorial copy. The country, directory
 * and consultant data these sections wrap always stays data-driven -- only
 * eyebrow/heading/subheading text can be overridden this way. */
const SECTION_KEYS = new Set([
  'hero',
  'region',
  'ctaBand',
  'az',
  'ctaTwo',
  'consultants',
  'final',
]);

async function loadContentOverrides(): Promise<Record<string, SectionCopy | undefined>> {
  try {
    const page = await phasePage<AnyRecord>('countries');
    const overrides: Record<string, SectionCopy> = {};
    for (const section of page?.sections ?? []) {
      const key = section.sectionKey;
      if (!key || !SECTION_KEYS.has(key)) continue;
      overrides[key] = {
        eyebrow: section.eyebrow ?? undefined,
        heading: section.heading ?? undefined,
        subheading: section.subheading ?? undefined,
      };
    }
    return overrides;
  } catch {
    return {};
  }
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return staticPageMetadata(
    'countries-listing',
    'Study destinations',
    'Explore structured study destinations and plan your next step with Universta.',
    '/countries',
  );
}

type SearchParams = Record<string, string | string[] | undefined>;
const allowed = [
  'q',
  'region',
  'budgetBand',
  'ieltsOptional',
  'intake',
  'visaSuccessBand',
  'pathwayStrength',
  'hasTopRankedUniversities',
  'page',
] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: SearchParams) {
  return Object.fromEntries(
    allowed.flatMap((key) => {
      const value = one(searchParams[key]);
      return value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;
}

/** `region` is the shareable public name for what the API calls `continent`. */
function apiFilters(filters: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) result[key === 'region' ? 'continent' : key] = value;
  }
  return result;
}

async function loadData(filters: Record<string, string>) {
  try {
    const [countries, continents, directory, consultants, everyCountry] = await Promise.all([
      getCountries({ ...apiFilters(filters), limit: '12' }),
      getContinents(),
      getDirectory({ limit: '100' }),
      phaseList<AnyRecord>('consultants', { limit: '6' }).catch(() => ({ data: [] as AnyRecord[] })),
      // Unfiltered, so the region tabs can carry a real count and a region with
      // no published destination is not offered at all.
      getCountries({ limit: '100' }).then((result) => result.data),
    ]);
    const perRegion = new Map<string, number>();
    for (const country of everyCountry) {
      const slug = country.continent?.slug;
      if (slug) perRegion.set(slug, (perRegion.get(slug) ?? 0) + 1);
    }
    return {
      countries: countries.data,
      meta: countries.meta,
      continents: continents
        .filter((item) => item.status === 'ACTIVE' && perRegion.get(item.slug))
        .map(({ id, name, slug }) => ({ id, name, slug, count: perRegion.get(slug) ?? 0 })),
      directory: directory.data,
      directoryMeta: directory.meta,
      consultants: consultants.data,
    };
  } catch {
    return null;
  }
}

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const [data, content] = await Promise.all([loadData(filters), loadContentOverrides()]);
  if (!data) {
    return (
      <main className="shell error-page">
        <p className="eyebrow">Study destinations</p>
        <h1>Destinations are temporarily unavailable</h1>
        <p>Please try again shortly.</p>
        <Link className="button" href="/countries">
          Retry
        </Link>
      </main>
    );
  }

  return (
    <CountriesReference
      countries={data.countries}
      meta={data.meta}
      continents={data.continents}
      directory={data.directory}
      directoryMeta={data.directoryMeta}
      consultants={data.consultants.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
        summary: typeof row.shortDescription === 'string' ? row.shortDescription : null,
        verified: row.verificationStatus === 'VERIFIED',
      }))}
      filters={filters}
      content={content}
    />
  );
}

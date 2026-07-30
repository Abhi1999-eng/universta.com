import Link from 'next/link';
import { ApprovedCountriesListing, type CountryListingOverrides } from '@/components/templates/ApprovedTemplatePages';
import { getContinents, getCountries, getDirectory } from '@/lib/countries';
import { phaseList, phasePage } from '@/lib/phase1';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { staticPageMetadata } from '@/lib/static-page-seo';

/** Section keys an admin can use, via the generic Page CMS (Phase 1 content
 * -> Pages -> a page with slug "countries"), to override this listing's
 * Hero and editorial section copy. The live country/consultant/directory
 * data these sections wrap always stays data-driven -- only eyebrow/
 * heading/subheading text can be overridden this way. */
const COUNTRY_LISTING_SECTION_KEYS = new Set([
  'hero',
  'region',
  'ctaBand',
  'az',
  'ctaTwo',
  'consultants',
  'final',
]);
async function loadContentOverrides(): Promise<CountryListingOverrides> {
  try {
    const page = await phasePage<AnyRecord>('countries');
    const overrides: CountryListingOverrides = {};
    for (const section of page?.sections ?? []) {
      const key = section.sectionKey;
      if (!key || !COUNTRY_LISTING_SECTION_KEYS.has(key)) continue;
      overrides[key as keyof CountryListingOverrides] = {
        eyebrow: section.eyebrow,
        heading: section.heading,
        subheading: section.subheading,
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
const allowed = ['q', 'region', 'budgetBand', 'ieltsOptional', 'intake', 'visaSuccessBand', 'pathwayStrength', 'hasTopRankedUniversities', 'page'] as const;
type ListingFilters = Partial<Record<(typeof allowed)[number], string>>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseFilters(searchParams: SearchParams): ListingFilters {
  return Object.fromEntries(allowed.flatMap((key) => { const value = one(searchParams[key]); return value ? [[key, value]] : []; })) as ListingFilters;
}
function apiFilters(filters: ListingFilters) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) if (value) result[key === 'region' ? 'continent' : key] = value;
  return result;
}
async function loadData(filters: ListingFilters) {
  try {
    const [countries, continents, directory, consultants] = await Promise.all([
      getCountries({ ...apiFilters(filters), limit: '12' }),
      getContinents(),
      getDirectory({ limit: '100' }),
      phaseList<AnyRecord>('consultants', { limit: '6' }).catch(() => ({ data: [] as AnyRecord[] })),
    ]);
    return { countries: countries.data, meta: countries.meta, continents, directory: directory.data, directoryMeta: directory.meta, consultants: consultants.data };
  } catch { return null; }
}

export default async function CountriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const [data, content] = await Promise.all([loadData(filters), loadContentOverrides()]);
  if (!data) return <main className="shell error-page"><p className="eyebrow">Countries</p><h1>Destinations are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/countries">Retry</Link></main>;
  const activeContinents = data.continents.filter((item) => item.status === 'ACTIVE');
  return <ApprovedCountriesListing countries={data.countries} meta={data.meta} continents={activeContinents} directory={data.directory} directoryMeta={data.directoryMeta} consultants={data.consultants} filters={filters} content={content} />;
}

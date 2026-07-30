import Link from 'next/link';
import type { Metadata } from 'next';
import { ApprovedCountriesListing } from '@/components/templates/ApprovedTemplatePages';
import { getContinents, getCountries, getDirectory } from '@/lib/countries';
import { phaseList } from '@/lib/phase1';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Study destinations | Universta', description: 'Explore structured study destinations and plan your next step with Universta.' };

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
  const data = await loadData(filters);
  if (!data) return <main className="shell error-page"><p className="eyebrow">Countries</p><h1>Destinations are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/countries">Retry</Link></main>;
  const activeContinents = data.continents.filter((item) => item.status === 'ACTIVE');
  return <ApprovedCountriesListing countries={data.countries} meta={data.meta} continents={activeContinents} directory={data.directory} directoryMeta={data.directoryMeta} consultants={data.consultants} filters={filters} />;
}

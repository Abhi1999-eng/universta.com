import Link from 'next/link';
import type { Metadata } from 'next';
import { CountriesExplorer } from '@/components/countries/CountriesExplorer';
import { SiteFooter, SiteHeader } from '@/components/countries/SiteChrome';
import { getContinents, getCountries, getDirectory } from '@/lib/countries';

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
    const [countries, continents, directory] = await Promise.all([
      getCountries({ ...apiFilters(filters), limit: '12' }),
      getContinents(),
      getDirectory({ limit: '100' }),
    ]);
    return { countries: countries.data, meta: countries.meta, continents, directory: directory.data, directoryMeta: directory.meta };
  } catch { return null; }
}

export default async function CountriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseFilters(await searchParams);
  const data = await loadData(filters);
  if (!data) return <main className="shell error-page"><p className="eyebrow">Countries</p><h1>Destinations are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/countries">Retry</Link></main>;
  const activeContinents = data.continents.filter((item) => item.status === 'ACTIVE');
  return <main><SiteHeader /><section className="listing-hero"><div className="shell"><p className="eyebrow">Your global study journey</p><h1>Find the right country for your future</h1><p>Compare destinations through structured, source-aware guidance built around your goals.</p></div></section><CountriesExplorer countries={data.countries} meta={data.meta} continents={activeContinents} directory={data.directory} directoryMeta={data.directoryMeta} filters={filters} /><SiteFooter /></main>;
}

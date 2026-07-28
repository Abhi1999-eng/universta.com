import Link from 'next/link';
import { ApprovedCountriesListing } from '@/components/templates/ApprovedTemplatePages';
import { getContinents, getCountries, getDirectory } from '@/lib/countries';

export type CountriesSearchParams = Record<string, string | string[] | undefined>;
const allowed = ['q', 'region', 'budgetBand', 'ieltsOptional', 'intake', 'visaSuccessBand', 'pathwayStrength', 'hasTopRankedUniversities', 'page'] as const;
type ListingFilters = Partial<Record<(typeof allowed)[number], string>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCountryFilters(searchParams: CountriesSearchParams): ListingFilters {
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
  } catch {
    return null;
  }
}

export async function CountriesLandingPage({ filters, retryHref = '/' }: { filters: ListingFilters; retryHref?: string }) {
  const data = await loadData(filters);
  if (!data) {
    return (
      <main className="shell error-page">
        <p className="eyebrow">Countries</p>
        <h1>Destinations are temporarily unavailable</h1>
        <p>Please try again shortly.</p>
        <Link className="button" href={retryHref}>Retry</Link>
      </main>
    );
  }
  const activeContinents = data.continents.filter((item) => item.status === 'ACTIVE');
  return (
    <ApprovedCountriesListing
      countries={data.countries}
      meta={data.meta}
      continents={activeContinents}
      directory={data.directory}
      directoryMeta={data.directoryMeta}
      filters={filters}
    />
  );
}

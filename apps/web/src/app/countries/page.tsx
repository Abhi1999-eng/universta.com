import type { Metadata } from 'next';
import { CountriesLandingPage, parseCountryFilters, type CountriesSearchParams } from '@/components/pages/CountriesLandingPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Study destinations | Universta', description: 'Explore structured study destinations and plan your next step with Universta.' };

export default async function CountriesPage({ searchParams }: { searchParams: Promise<CountriesSearchParams> }) {
  const filters = parseCountryFilters(await searchParams);
  return <CountriesLandingPage filters={filters} retryHref="/countries" />;
}

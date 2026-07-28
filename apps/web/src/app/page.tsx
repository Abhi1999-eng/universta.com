import type { Metadata } from 'next';
import { CountriesLandingPage, parseCountryFilters, type CountriesSearchParams } from '@/components/pages/CountriesLandingPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Universta — Study Abroad Made Simple',
  description: 'Explore published study destinations, compare countries side by side, and book free counselling with Universta.',
};

export default async function Home({ searchParams }: { searchParams: Promise<CountriesSearchParams> }) {
  const filters = parseCountryFilters(await searchParams);
  return <CountriesLandingPage filters={filters} retryHref="/" />;
}

import Link from 'next/link';
import type { Metadata } from 'next';
import { CountriesExplorer } from '@/components/countries/CountriesExplorer';
import { getContinents, getCountries } from '@/lib/countries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Study destinations | Universta', description: 'Explore structured study destinations and plan your next step with Universta.' };
async function loadData() { try { return await Promise.all([getCountries({ limit: '100' }), getContinents()]); } catch { return null; } }
export default async function CountriesPage() {
  const data = await loadData();
  if (!data) return <main className="shell error-page"><p className="eyebrow">Countries</p><h1>Destinations are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/countries">Retry</Link></main>;
  const [countries, continents] = data;
  return <main><header className="site-header"><div className="shell header-inner"><span className="brand">universta<span>.</span></span><nav aria-label="Primary navigation"><Link href="/countries">Countries</Link><a href="#country-search-heading">Explore</a></nav></div></header><section className="listing-hero"><div className="shell"><p className="eyebrow">Your global study journey</p><h1>Find the right country for your future</h1><p>Compare destinations through structured, source-aware guidance built around your goals.</p></div></section><CountriesExplorer countries={countries} continents={continents.filter((item) => item.status === 'ACTIVE')} /></main>;
}

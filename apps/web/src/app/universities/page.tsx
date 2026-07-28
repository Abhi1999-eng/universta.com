import type { Metadata } from 'next';
import Link from 'next/link';
import { UniversityListing, type University, type PageMeta } from '@/components/templates/DirectoryTemplatePages';
import { phaseList } from '@/lib/phase1';
import { getCountries, type Country } from '@/lib/countries';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Universities | Universta',
  description: 'Explore published universities and compare real campuses, courses and intakes.',
  alternates: { canonical: '/universities' },
};

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function unavailable() {
  return (
    <main className="shell error-page">
      <p className="eyebrow">Universities</p>
      <h1>Universities are temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link className="button" href="/universities">Retry</Link>
    </main>
  );
}

export default async function UniversitiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    (['q', 'country', 'type', 'subject', 'page'] as const).flatMap((key) => {
      const value = one(raw[key]);
      return value ? [[key, value]] : [];
    }),
  );
  let result: { data: University[]; meta: unknown };
  let countries: Country[];
  try {
    [result, countries] = await Promise.all([
      phaseList<University>('universities', filters),
      getCountries({ limit: '100' }).then((response) => response.data).catch(() => []),
    ]);
  } catch {
    return unavailable();
  }
  return (
    <UniversityListing
      universities={result.data}
      meta={result.meta as PageMeta}
      countries={countries}
      filters={filters}
    />
  );
}

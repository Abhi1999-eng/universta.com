import type { Metadata } from 'next';
import Link from 'next/link';
import { ConsultantListing, type Consultant, type PageMeta } from '@/components/templates/DirectoryTemplatePages';
import { phaseList } from '@/lib/phase1';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Study abroad consultants | Universta',
  description: 'Explore published consultant profiles and the services and destinations they support.',
  alternates: { canonical: '/study-abroad-consultants' },
};

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function unavailable() {
  return (
    <main className="shell error-page">
      <p className="eyebrow">Consultants</p>
      <h1>Study abroad consultants are temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link className="button" href="/study-abroad-consultants">Retry</Link>
    </main>
  );
}

export default async function ConsultantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    (['q', 'location', 'country', 'service', 'language', 'verified', 'page'] as const).flatMap((key) => {
      const value = one(raw[key]);
      return value ? [[key, value]] : [];
    }),
  );
  let result: { data: Consultant[]; meta: unknown };
  try {
    result = await phaseList<Consultant>('consultants', filters);
  } catch {
    return unavailable();
  }
  return <ConsultantListing consultants={result.data} meta={result.meta as PageMeta} filters={filters} />;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ScholarshipListing, type Scholarship, type PageMeta } from '@/components/templates/DirectoryTemplatePages';
import { phaseList } from '@/lib/phase1';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Scholarships | Universta',
  description: 'Explore published scholarships and compare award amounts, deadlines and eligibility.',
  alternates: { canonical: '/scholarships' },
};

type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function unavailable() {
  return (
    <main className="shell error-page">
      <p className="eyebrow">Scholarships</p>
      <h1>Scholarships are temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link className="button" href="/scholarships">Retry</Link>
    </main>
  );
}

export default async function ScholarshipsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    (['q', 'country', 'university', 'type', 'deadline', 'page'] as const).flatMap((key) => {
      const value = one(raw[key]);
      return value ? [[key, value]] : [];
    }),
  );
  let result: { data: Scholarship[]; meta: unknown };
  try {
    result = await phaseList<Scholarship>('scholarships', filters);
  } catch {
    return unavailable();
  }
  return <ScholarshipListing scholarships={result.data} meta={result.meta as PageMeta} filters={filters} />;
}

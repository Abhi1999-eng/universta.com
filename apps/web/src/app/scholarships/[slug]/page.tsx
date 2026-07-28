import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ScholarshipDetail, type Scholarship } from '@/components/templates/DirectoryTemplatePages';
import { phaseDetail } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function scholarship(slug: string) {
  try {
    return await phaseDetail<Scholarship>('scholarships', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await scholarship(slug);
  if (!row) return { title: 'Scholarship not found | Universta', robots: { index: false } };
  return {
    title: `${row.title} | Universta`,
    description: row.summary ?? `Explore ${row.title}.`,
    alternates: { canonical: `/scholarships/${row.slug ?? slug}` },
  };
}

export default async function ScholarshipPage({ params }: Props) {
  const { slug } = await params;
  const row = await scholarship(slug);
  if (!row) notFound();
  return <ScholarshipDetail scholarship={row} />;
}

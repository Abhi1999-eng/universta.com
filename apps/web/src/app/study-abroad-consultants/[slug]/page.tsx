import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConsultantDetail, type Consultant } from '@/components/templates/DirectoryTemplatePages';
import { phaseDetail } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function consultant(slug: string) {
  try {
    return await phaseDetail<Consultant>('consultants', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) return { title: 'Consultant not found | Universta', robots: { index: false } };
  return {
    title: `${row.name} | Universta`,
    description: row.shortDescription ?? `Explore ${row.name}.`,
    alternates: { canonical: `/study-abroad-consultants/${row.slug ?? slug}` },
  };
}

export default async function ConsultantPage({ params }: Props) {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) notFound();
  return <ConsultantDetail consultant={row} />;
}

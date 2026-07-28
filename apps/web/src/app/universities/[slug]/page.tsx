import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UniversityDetail, type University } from '@/components/templates/DirectoryTemplatePages';
import { phaseDetail } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function university(slug: string) {
  try {
    return await phaseDetail<University>('universities', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) return { title: 'University not found | Universta', robots: { index: false } };
  return {
    title: `${row.name} | Universta`,
    description: row.shortDescription ?? `Explore ${row.name}, published courses and campuses.`,
    alternates: { canonical: `/universities/${row.slug ?? slug}` },
  };
}

export default async function UniversityPage({ params }: Props) {
  const { slug } = await params;
  const row = await university(slug);
  if (!row) notFound();
  return <UniversityDetail university={row} />;
}

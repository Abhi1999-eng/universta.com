import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConsultantLocationDetail, type ConsultantLocationRow } from '@/components/templates/DirectoryTemplatePages';
import { phaseLocation } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locationSlug: string }> };

async function consultantLocation(slug: string) {
  try {
    return await phaseLocation<ConsultantLocationRow>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locationSlug } = await params;
  const row = await consultantLocation(locationSlug);
  if (!row) return { title: 'Consultant location not found | Universta', robots: { index: false } };
  return {
    title: `${row.name} | Universta`,
    description: row.overview ?? `Study abroad consultants in ${row.name}.`,
    alternates: { canonical: `/study-abroad-consultants/locations/${row.slug ?? locationSlug}` },
  };
}

export default async function ConsultantLocationPage({ params }: Props) {
  const { locationSlug } = await params;
  const row = await consultantLocation(locationSlug);
  if (!row) notFound();
  return <ConsultantLocationDetail location={row} />;
}

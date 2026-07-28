import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UniversityCourseDetail, type Offering } from '@/components/templates/DirectoryTemplatePages';
import { phaseUniversityCourses } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; offeringSlug: string }> };

async function universityCourse(universitySlug: string, offeringSlug: string) {
  try {
    return await phaseUniversityCourses<Offering>(universitySlug, offeringSlug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, offeringSlug } = await params;
  const row = await universityCourse(slug, offeringSlug);
  if (!row) return { title: 'University course not found | Universta', robots: { index: false } };
  return {
    title: `${row.name} | Universta`,
    description: row.shortDescription ?? `Explore ${row.name}.`,
    alternates: { canonical: `/universities/${slug}/courses/${row.slug ?? offeringSlug}` },
  };
}

export default async function UniversityCoursePage({ params }: Props) {
  const value = await params;
  const row = await universityCourse(value.slug, value.offeringSlug);
  if (!row) notFound();
  return <UniversityCourseDetail offering={row} />;
}

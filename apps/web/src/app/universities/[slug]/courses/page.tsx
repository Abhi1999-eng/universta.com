import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UniversityCoursesListing, type Offering } from '@/components/templates/DirectoryTemplatePages';
import { phaseUniversityCourses } from '@/lib/phase1';

export const dynamic = 'force-dynamic';

type UniversityCoursesResult = {
  university?: { name?: string; slug?: string };
  data?: Offering[];
  meta?: { page: number; total: number; totalPages: number };
};

type Props = { params: Promise<{ slug: string }> };

async function universityCourses(slug: string) {
  try {
    return await phaseUniversityCourses<UniversityCoursesResult>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await universityCourses(slug);
  const name = result?.university?.name ?? 'University';
  return result
    ? { title: `${name} courses | Universta`, description: `Published university courses from ${name}.`, alternates: { canonical: `/universities/${slug}/courses` } }
    : { title: 'University courses not found | Universta', robots: { index: false } };
}

export default async function UniversityCoursesPage({ params }: Props) {
  const value = await params;
  const result = await universityCourses(value.slug);
  if (!result) notFound();
  return (
    <UniversityCoursesListing
      university={{ name: result.university?.name ?? 'University', slug: value.slug }}
      offerings={result.data ?? []}
      meta={result.meta ?? { page: 1, total: 0, totalPages: 0 }}
    />
  );
}

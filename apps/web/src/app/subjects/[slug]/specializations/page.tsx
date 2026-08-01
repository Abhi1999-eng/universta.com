import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject } from '@/lib/catalog';
import { ApprovedSpecializations } from '@/components/templates/AcademicTemplatePages';

type Props = { params: Promise<{ slug: string }> };
async function load(slug: string) { try { return await getSubject(slug); } catch { return null; } }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const subject = await load(slug);
  // Every other public route declares a canonical; this one declared none,
  // leaving its preferred URL ambiguous to search engines.
  const alternates = { canonical: `/subjects/${slug}/specializations` };
  if (!subject) return { title: 'Specialisations not found | Universta', alternates };
  return {
    title: `${subject.name} specialisations | Universta`,
    description: `Explore published ${subject.name} specialisations and course pathways.`,
    alternates,
  };
}
export default async function SubjectSpecializationsPage({ params }: Props) { const slug = (await params).slug; const subject = await load(slug); if (!subject) notFound(); return <ApprovedSpecializations subject={subject} />; }

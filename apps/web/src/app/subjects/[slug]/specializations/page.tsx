import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject, getSubjects } from '@/lib/catalog';
import { ApprovedSpecializations } from '@/components/templates/ApprovedTemplatePages';

type Props = { params: Promise<{ slug: string }> };
async function load(slug: string) { try { return await getSubject(slug); } catch { return null; } }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const subject = await load((await params).slug); if (!subject) return { title: 'Specialisations not found | Universta' }; return { title: `${subject.name} specialisations | Universta`, description: `Explore published ${subject.name} specialisations and course pathways.` }; }
export default async function SubjectSpecializationsPage({ params }: Props) {
  const slug = (await params).slug;
  const subject = await load(slug);
  if (!subject) notFound();
  const siblingSubjects = await getSubjects({ limit: '12' }).then((result) => result.data).catch(() => []);
  return <ApprovedSpecializations subject={subject} subjects={siblingSubjects} />;
}

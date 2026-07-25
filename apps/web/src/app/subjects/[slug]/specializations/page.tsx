import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSubject } from '@/lib/catalog';
import { SubjectSpecializationsView } from '@/components/catalog/SubjectSpecializationsView';

type Props = { params: Promise<{ slug: string }> };
async function load(slug: string) { try { return await getSubject(slug); } catch { return null; } }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const subject = await load((await params).slug); if (!subject) return { title: 'Specialisations not found | Universta' }; return { title: `${subject.name} specialisations | Universta`, description: `Explore published ${subject.name} specialisations and course pathways.` }; }
export default async function SubjectSpecializationsPage({ params }: Props) { const subject = await load((await params).slug); if (!subject) notFound(); return <SubjectSpecializationsView subject={subject} />; }

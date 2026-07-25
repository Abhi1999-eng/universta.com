import type { Metadata } from 'next';
import Link from 'next/link';
import { getSubjects } from '@/lib/catalog';
import { ApprovedSubjectsListing } from '@/components/templates/ApprovedTemplatePages';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Subjects | Universta', description: 'Explore published study subjects and course pathways.' };
type SearchParams = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
export default async function SubjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) { const params = await searchParams; let data: Awaited<ReturnType<typeof getSubjects>> | null = null; try { data = await getSubjects({ q: one(params.q) ?? '', page: one(params.page) ?? '1', limit: '100' }); } catch { return <main className="error-page shell"><p className="eyebrow">Subjects</p><h1>Subjects are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/subjects">Retry</Link></main>; } return <ApprovedSubjectsListing subjects={data.data} meta={data.meta} />; }

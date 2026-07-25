import type { Metadata } from 'next';
import Link from 'next/link';
import { getCountries } from '@/lib/countries';
import { getCourseLevels, getCourses, getStudyModes, getSubjects } from '@/lib/catalog';
import { ApprovedCoursesListing } from '@/components/templates/ApprovedTemplatePages';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Courses | Universta', description: 'Search published courses by subject, level, study mode, and country.' };
type SearchParams = Record<string, string | string[] | undefined>;
const keys = ['q', 'subject', 'subSubject', 'level', 'country', 'studyMode', 'intake', 'scholarshipAvailable', 'featured', 'minTuition', 'maxTuition', 'sort', 'page'] as const;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function unavailable() { return <main className="error-page shell"><p className="eyebrow">Courses</p><h1>Courses are temporarily unavailable</h1><p>Please try again shortly.</p><Link className="button" href="/courses">Retry</Link></main>; }
type Data = Awaited<ReturnType<typeof getCourses>> & { subjects: Awaited<ReturnType<typeof getSubjects>>['data']; levels: Awaited<ReturnType<typeof getCourseLevels>>; modes: Awaited<ReturnType<typeof getStudyModes>>; countries: Array<{ id: string; name: string; slug: string }> };
export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) { const raw = await searchParams; const filters = Object.fromEntries(keys.flatMap((key) => { const value = one(raw[key]); return value ? [[key, value]] : []; })) as Record<string, string>; let data: Data; try { const [courses, subjects, levels, modes, countries] = await Promise.all([getCourses({ ...filters, limit: '100' }), getSubjects({ limit: '100' }).then((result) => result.data), getCourseLevels(), getStudyModes(), getCountries({ limit: '100' }).then((result) => result.data.map((item) => ({ id: item.id, name: item.name, slug: item.slug })))]); data = { ...courses, subjects, levels, modes, countries }; } catch { return unavailable(); } return <ApprovedCoursesListing courses={data.data} meta={data.meta} subjects={data.subjects} levels={data.levels} modes={data.modes} countries={data.countries} />; }

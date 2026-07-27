import { EditorialPage } from '@/components/phase1/EditorialPage';
import { phasePage } from '@/lib/phase1';
export const dynamic = 'force-dynamic';
export default async function HomePage() { let page: any = null; try { page = await phasePage<any>('home'); } catch {} return <EditorialPage home page={page} fallbackTitle="Plan your study abroad journey with clarity." fallbackDescription="Explore published countries, subjects, courses, universities and scholarships, then speak with a counsellor when you are ready." />; }

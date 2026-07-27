import type { MetadataRoute } from 'next';
import { phaseList } from '@/lib/phase1';
const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ['/', '/about', '/contact', '/faq', '/countries', '/subjects', '/courses', '/universities', '/scholarships', '/study-abroad-consultants', '/counselling', '/success-stories', '/testimonials', '/careers', '/events'].map((path) => ({ url: new URL(path, base).toString(), changeFrequency: 'weekly' as const, priority: path === '/' ? 1 : 0.7 }));
  try { const [universities, scholarships, consultants, jobs, events, stories] = await Promise.all(['universities', 'scholarships', 'consultants', 'jobs', 'events', 'success-stories'].map((resource) => phaseList<any>(resource, { limit: '50' }))); const dynamic = [
      ...universities.data.map((row) => `/universities/${row.slug}`), ...scholarships.data.map((row) => `/scholarships/${row.slug}`), ...consultants.data.map((row) => `/study-abroad-consultants/${row.slug}`), ...jobs.data.map((row) => `/careers/${row.slug}`), ...events.data.map((row) => `/events/${row.slug}`), ...stories.data.map((row) => `/success-stories/${row.slug}`),
    ].map((path) => ({ url: new URL(path, base).toString(), changeFrequency: 'weekly' as const, priority: 0.6 })); return [...staticRoutes, ...dynamic]; } catch { return staticRoutes; }
}

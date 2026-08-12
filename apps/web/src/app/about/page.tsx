import { headers } from 'next/headers';
import { AboutReference } from '@/components/reference/AboutReference';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getCountries } from '@/lib/countries';
import { getCourses, getSubjects } from '@/lib/catalog';
import { phaseList, phasePage } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return staticPageMetadata(
    'about',
    'About Universta',
    'How Universta publishes study abroad information, and what it will not claim.',
    '/about',
  );
}

/** Section keys an admin can override through the managed "about" Page. */
const SECTION_KEYS = new Set(['mission', 'why', 'how', 'community']);

export default async function AboutPage() {
  let page: AnyRecord | null = null;
  try {
    const anonymousId = (await headers()).get('x-anon-id') ?? undefined;
    page = await phasePage<AnyRecord>('about', anonymousId);
  } catch {
    // The page keeps its built-in copy when the managed record is absent.
  }

  const sections: Record<string, { heading?: string; subheading?: string }> = {};
  for (const section of page?.sections ?? []) {
    const key = section.sectionKey;
    if (!key || !SECTION_KEYS.has(key)) continue;
    sections[key] = {
      heading: section.heading ?? undefined,
      subheading: section.eyebrow ?? section.subheading ?? undefined,
    };
  }

  // Real catalogue totals for the two stat strips. Each falls back to zero,
  // and a zero is dropped rather than shown as a claim.
  const [countries, universities, courses, scholarships, subjects, consultants] = await Promise.all(
    [
      getCountries({ limit: '1' })
        .then((r) => r.meta.total)
        .catch(() => 0),
      phaseList<AnyRecord>('universities', { limit: '1' })
        .then((r) => (r.meta as { total?: number }).total ?? 0)
        .catch(() => 0),
      getCourses({ pageSize: '1' })
        .then((r) => r.meta.total)
        .catch(() => 0),
      phaseList<AnyRecord>('scholarships', { limit: '1' })
        .then((r) => (r.meta as { total?: number }).total ?? 0)
        .catch(() => 0),
      getSubjects({ limit: '1' })
        .then((r) => r.meta.total)
        .catch(() => 0),
      phaseList<AnyRecord>('consultants', { limit: '1' })
        .then((r) => (r.meta as { total?: number }).total ?? 0)
        .catch(() => 0),
    ],
  );

  return (
    <AboutReference
      heading={
        (typeof page?.title === 'string' && page.title !== 'About Universta'
          ? page.title
          : null) ?? 'Helping students build their future through global education'
      }
      lede={
        (typeof page?.shortDescription === 'string' ? page.shortDescription : null) ??
        'Universta publishes study abroad information you can trace back to a source: destinations, universities, courses, scholarships and consultants, with search and comparison tools that never show a figure the catalogue cannot support.'
      }
      totals={[
        { value: countries, label: 'Destinations' },
        { value: universities, label: 'Universities' },
        { value: courses, label: 'Courses' },
        { value: scholarships, label: 'Scholarships' },
        { value: subjects, label: 'Subjects' },
        { value: consultants, label: 'Consultants' },
      ]}
      sections={sections}
    />
  );
}

import { notFound, permanentRedirect } from 'next/navigation';
import { withQuery } from '@/lib/university-courses';
import { universityPlace } from '@/lib/university-courses-server';
import { offeringHref } from '@/lib/university-links';

/**
 * /universities/<slug>/courses/<course>, a course's old address.
 *
 * Sent on permanently to the same course under the university's country,
 * with whatever query the old link carried. Whether the course itself still
 * exists is the new page's question, so a withdrawn course ends on its
 * not-found page rather than here.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string; offeringSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UniversityCourseMoved({ params, searchParams }: Props) {
  const { slug, offeringSlug } = await params;
  const university = await universityPlace(slug);
  if (!university) notFound();
  permanentRedirect(
    withQuery(
      offeringHref(university.country.slug, university.slug, offeringSlug),
      await searchParams,
    ),
  );
}

import { notFound, permanentRedirect } from 'next/navigation';
import { universityPlace } from '@/lib/university-courses-server';
import { universityCoursesHref } from '@/lib/university-links';

/**
 * /universities/<slug>/courses, the course list's old address.
 *
 * A university's courses are filed under its country now, as the behaviour
 * reference files them. Links written before the move -- bookmarks, search
 * results, the comparison page -- are sent on permanently, filters and all:
 * the new list still reads the old filter names.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UniversityCoursesMoved({ params, searchParams }: Props) {
  const { slug } = await params;
  const university = await universityPlace(slug);
  if (!university) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const entry of Array.isArray(value) ? value : value ? [value] : [])
      query.append(key, entry);
  const search = query.toString();
  permanentRedirect(
    `${universityCoursesHref(university.country.slug, university.slug)}${search ? `?${search}` : ''}`,
  );
}

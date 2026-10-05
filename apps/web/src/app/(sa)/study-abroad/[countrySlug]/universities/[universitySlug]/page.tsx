import { permanentRedirect } from 'next/navigation';
import { withQuery } from '@/lib/university-courses';
import { universityHref } from '@/lib/university-links';

/**
 * /study-abroad/<country>/universities/<university>.
 *
 * Everything below a university is filed under its country, but the
 * profile itself stays flat at /universities/<university>, and the behaviour
 * reference answers this nested address with a permanent redirect there.
 * So does this, query and all. Whether the university exists is the
 * profile's question to answer, with its own not-found page.
 */
type Props = {
  params: Promise<{ countrySlug: string; universitySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { universitySlug } = await params;
  permanentRedirect(withQuery(universityHref(universitySlug), await searchParams));
}

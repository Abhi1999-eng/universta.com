import { permanentRedirect } from 'next/navigation';
import { universityHref } from '@/lib/university-links';

/**
 * /study-abroad/<country>/universities/<university>.
 *
 * Everything below a university is filed under its country, but the
 * profile itself stays flat at /universities/<university>, and the behaviour
 * reference answers this nested address with a permanent redirect there.
 * So does this. Whether the university exists is the profile's question to
 * answer, with its own not-found page.
 */
type Props = {
  params: Promise<{ countrySlug: string; universitySlug: string }>;
};

export default async function Page({ params }: Props) {
  const { universitySlug } = await params;
  permanentRedirect(universityHref(universitySlug));
}

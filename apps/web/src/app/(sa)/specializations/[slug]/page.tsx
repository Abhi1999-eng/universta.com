import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { getSpecializations } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/**
 * A flat address for something that lives inside a subject.
 *
 * The page itself is /subjects/<subject>/<specialization>, because a slug is
 * only unique within its subject -- "Animal Science" is taught under three of
 * them. This route exists so a link that only knows the branch still lands
 * somewhere useful, and it redirects rather than rendering a second copy.
 *
 * Where a slug is genuinely ambiguous it sends you to the listing filtered by
 * that name, which shows the subject each one belongs to, rather than picking
 * a subject on your behalf.
 */
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SpecializationRedirectPage({ params }: Props) {
  const { slug } = await params;
  const matches = await getSpecializations({ slug, limit: '5' })
    .then((result) => result.data)
    .catch(() => []);

  if (matches.length === 1) {
    const [only] = matches;
    permanentRedirect(`/subjects/${only.subject.slug}/${only.slug}`);
  }
  if (matches.length > 1) {
    redirect(`/specializations?q=${encodeURIComponent(matches[0].name)}`);
  }
  redirect('/specializations');
}

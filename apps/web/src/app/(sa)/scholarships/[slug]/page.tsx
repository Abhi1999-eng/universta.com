import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { ConnectBand, MatchBand } from '@/components/study-abroad/DiscoveryBands';
import { ScholarshipGuide, scholarshipCardOf } from '@/components/study-abroad/ScholarshipGuide';
import { countryScholarshipsHref } from '@/lib/country-scholarship-list';
import { phaseDetail, phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { toScholarshipCards } from '@/lib/scholarship-card';
import { getDestinations } from '@/lib/study-abroad';
import { countryUniversitiesHref } from '@/lib/university-links';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/** How many related awards the page shows under the record. */
const RELATED_SHOWN = 3;

async function scholarship(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('scholarships', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await scholarship(slug);
  if (!row) return { title: { absolute: 'Scholarship not found | Universta' }, robots: { index: false } };
  const metadata = phaseOneMetadata(row, `/scholarships/${row.slug ?? slug}`, 'Scholarship');
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function ScholarshipPage({ params }: Props) {
  const { slug } = await params;
  const row = await scholarship(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/scholarships/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const card = scholarshipCardOf(row);
  if (!card) notFound();

  const first = card.countries.find((place) => place.slug) ?? null;
  /* The guides and the related awards are cross-links, not the point of
     the page: a failure reaching either drops what it feeds, not the route. */
  const [directory, related] = await Promise.all([
    getDestinations().catch(() => null),
    phaseList<AnyRecord>('scholarships', { ...(first ? { country: first.slug } : {}), limit: String(RELATED_SHOWN + 1) })
      .then((result) => toScholarshipCards(result.data).filter((entry) => entry.slug !== card.slug).slice(0, RELATED_SHOWN))
      .catch(() => []),
  ]);
  const guides = new Set((directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])));
  const home = first && guides.has(first.slug) ? first : null;
  const self = `/scholarships/${card.slug}`;

  return (
    <>
      <ScholarshipGuide record={row} card={card} related={related} guides={guides} />

      <MatchBand
        eyebrow={{ n: 'Profile match', label: 'Scholarship matching' }}
        heading={`Could ${card.title} be right for you?`}
        lead="Tell us your destination, level, subject and background. We look at each award's published eligibility and explain what we find."
        href={home ? countryScholarshipsHref(home.slug) : '/scholarships'}
        talkHref={`/counselling?source=scholarships&from=${encodeURIComponent(self)}`}
        assessment={{
          label: 'Check My Eligibility',
          intent: 'scholarships',
          note: "Final eligibility depends on the scholarship provider's official requirements.",
        }}
      />

      <ConnectBand
        actions={[
          { href: home ? countryScholarshipsHref(home.slug) : '/scholarships', label: home ? `Scholarships for ${home.name}` : 'All scholarships' },
          ...(home ? [{ href: `/study-abroad/${home.slug}`, label: `Study in ${home.name}`, ghost: true }] : []),
          ...(home ? [{ href: countryUniversitiesHref(home.slug), label: 'Universities there', ghost: true }] : []),
          { href: home ? `/courses?country=${home.slug}` : '/courses', label: 'Explore courses', ghost: true },
          ...(home ? [{ href: '/scholarships', label: 'All scholarships', ghost: true }] : []),
        ]}
      />
    </>
  );
}

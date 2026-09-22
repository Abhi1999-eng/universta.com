import type { Metadata } from 'next';
import Link from 'next/link';
import { DirectoryView } from '@/components/study-abroad/DirectoryView';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

const canonical = `${siteOrigin}/study-abroad`;

export async function generateMetadata(): Promise<Metadata> {
  const directory = await getDestinations().catch(() => null);
  const description = directory
    ? `${directory.counts.total} study destinations, with published guides for ${directory.counts.available}: costs, intakes, entry requirements and visa pathways.`
    : 'Every study destination Universta covers.';
  return {
    title: 'Every study destination',
    description,
    alternates: { canonical },
    openGraph: { title: 'Every study destination | Universta', description, url: canonical },
  };
}

/**
 * Every destination Universta covers: search, region, guide and "has"
 * filters, grouped by region. The homepage shows eight guides and links here
 * for the rest; `/countries` redirects here too.
 */
export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [directory, params] = await Promise.all([
    getDestinations().catch(() => null),
    searchParams,
  ]);
  if (!directory) {
    return (
      <section className="sec sec--white">
        <div className="wrap">
          <h1 className="sec-title">Destinations are temporarily unavailable</h1>
          <p className="sec-lead">Please try again shortly.</p>
          <Link className="btn" href="/study-abroad">
            Retry
          </Link>
        </div>
      </section>
    );
  }
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  return (
    <>
      <DirectoryView directory={directory} alt asPage initialQuery={q} />
      <PlanBand />
    </>
  );
}

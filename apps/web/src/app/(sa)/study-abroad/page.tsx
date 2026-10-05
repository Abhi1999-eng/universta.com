import type { Metadata } from 'next';
import Link from 'next/link';
import { ContinueJourney } from '@/components/study-abroad/ContinueJourney';
import { DirectoryView } from '@/components/study-abroad/DirectoryView';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { regionFromParam } from '@/lib/destination-search';
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
 *
 * It opens on the design's hero -- the question the page answers, set large
 * -- and the listing follows in a band of its own, as in the approved
 * directory template.
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
  const region = regionFromParam(
    typeof params.region === 'string' ? params.region : null,
    directory.regions,
  );
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Study abroad</span>
          </nav>
          <div className="dirhero">
            <p className="hero__eyebrow">
              Destination directory<b>·</b>
              {directory.counts.total} countries
            </p>
            <h1 className="hero__h1 dirhero__h1">Where do you want to study?</h1>
            <p className="hero__sub dirhero__sub">
              Browse every destination we cover. Published guides carry full costs, intakes,
              entry requirements and visa pathways.
            </p>
          </div>
        </div>
      </section>
      <DirectoryView
        directory={directory}
        alt={false}
        asPage
        initialQuery={q}
        initialRegion={region}
      />
      <PlanBand />
      {/* The visitor's own recent pages, when their browser has any: a
          directory is where somebody comparing destinations comes back to. */}
      <ContinueJourney alt />
    </>
  );
}

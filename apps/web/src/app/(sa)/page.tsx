import type { Metadata } from 'next';
import Link from 'next/link';
import { DirectoryView } from '@/components/study-abroad/DirectoryView';
import {
  HomeGuides,
  HomeHero,
  HomeInstitutions,
  HomeSupport,
  HomeTools,
  HomeTrust,
  StartPaths,
} from '@/components/study-abroad/HomeSections';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const directory = await getDestinations().catch(() => null);
  const total = directory?.counts.total ?? 0;
  return {
    title: 'Universta — study abroad destinations, universities and scholarships',
    description:
      'Browse every study destination. Published guides carry full costs, intakes, entry requirements and visa pathways.',
    /* The listing is the homepage now, so `/` is where it is canonically.
       `/study-abroad` and `/countries`, the two addresses the approved design
       published it at, redirect here rather than serving it a second time. */
    alternates: { canonical: siteOrigin },
    openGraph: {
      title: 'Universta — study abroad destinations, universities and scholarships',
      description: total
        ? `${total} destinations, with published guides for ${directory?.counts.available}.`
        : 'Browse every study destination.',
      url: siteOrigin,
    },
  };
}

/**
 * The homepage: every destination Universta covers.
 *
 * The approved design published this listing twice -- an exhaustive directory
 * at `/study-abroad` and a data-rich listing at `/countries`. They are one page
 * now, and that page is the homepage, so both of those addresses redirect here.
 * There is no breadcrumb: this is where a breadcrumb would point.
 */
export default async function HomePage() {
  const directory = await getDestinations().catch(() => null);

  if (!directory) {
    return (
      <section className="sec sec--white">
        <div className="wrap">
          <h1 className="hero__h1">Destinations are temporarily unavailable</h1>
          <p className="hero__sub">Please try again shortly.</p>
          <Link className="btn" href="/">
            Retry
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <HomeHero directory={directory} />
      <StartPaths />

      {/* The listing, where the design's own "countries" section sat. Its
          heading lives inside it rather than in a section of its own: split
          across two, the heading sat on paper while its cards sat on white,
          with a colour seam and 108px of nothing between a title and the
          thing it titles. */}
      <DirectoryView directory={directory} />

      <HomeTools />
      <HomeSupport />
      <HomeGuides />
      <HomeInstitutions />
      <HomeTrust />
      <PlanBand />
    </>
  );
}

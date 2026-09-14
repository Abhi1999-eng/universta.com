import type { Metadata } from 'next';
import Link from 'next/link';
import { DirectoryView } from '@/components/study-abroad/DirectoryView';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getDestinations } from '@/lib/study-abroad';
import { siteOrigin } from '@/lib/site-origin';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const directory = await getDestinations().catch(() => null);
  const total = directory?.counts.total ?? 0;
  return {
    title: 'Study Abroad — every destination we cover',
    description:
      'Browse every study destination. Published guides carry full costs, intakes, entry requirements and visa pathways.',
    alternates: { canonical: `${siteOrigin}/study-abroad` },
    openGraph: {
      title: 'Study Abroad — every destination we cover',
      description: total
        ? `${total} destinations, with published guides for ${directory?.counts.available}.`
        : 'Browse every study destination.',
      url: `${siteOrigin}/study-abroad`,
    },
  };
}

export default async function StudyAbroadDirectoryPage() {
  const directory = await getDestinations().catch(() => null);

  if (!directory) {
    return (
      <section className="sec sec--white">
        <div className="wrap">
          <h1 className="hero__h1">Destinations are temporarily unavailable</h1>
          <p className="hero__sub">Please try again shortly.</p>
          <Link className="btn" href="/study-abroad">
            Retry
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span className="crumbs__sep" aria-hidden="true">
              /
            </span>
            <span aria-current="page">Study Abroad</span>
          </nav>
          <div style={{ marginTop: 'clamp(22px,3vw,38px)', maxWidth: '820px' }}>
            <p className="hero__eyebrow">
              Destination directory<b>·</b>
              {directory.counts.total} countries
            </p>
            <h1
              className="hero__h1"
              style={{
                fontSize: 'var(--fs-display)',
                letterSpacing: '-0.045em',
                lineHeight: 1.02,
              }}
            >
              Where do you want to study?
            </h1>
            <p className="hero__sub" style={{ marginTop: 18 }}>
              Browse every destination we cover. Published guides carry full costs, intakes,
              entry requirements and visa pathways.
            </p>
          </div>
        </div>
      </section>

      <DirectoryView directory={directory} />
      <PlanBand />
    </>
  );
}

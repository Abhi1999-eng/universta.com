import type { Metadata } from 'next';
import Link from 'next/link';
import { DirectoryView } from '@/components/study-abroad/DirectoryView';
import {
  HomeCourses,
  HomeGuides,
  HomeHero,
  HomeInstitutions,
  HomeScholarships,
  HomeSubjects,
  HomeSupport,
  HomeTools,
  HomeTrust,
  HomeUniversities,
  StartPaths,
  type HomeCourse,
  type HomeScholarship,
  type HomeSubject,
  type HomeUniversity,
  type PopularLink,
} from '@/components/study-abroad/HomeSections';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getCourses, getSubjects } from '@/lib/catalog';
import { phaseList } from '@/lib/phase1';
import { getDestinations } from '@/lib/study-abroad';
import { alternatingBands } from '@/lib/study-abroad-view';
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
  /* The catalogue previews are read alongside the directory, and a failure in
     any one of them leaves its section out rather than taking the page down. */
  const [directory, subjects, universities, courses, scholarshipList] = await Promise.all([
    getDestinations().catch(() => null),
    getSubjects({ limit: '6' })
      .then((result) => result.data as unknown as HomeSubject[])
      .catch(() => []),
    phaseList<HomeUniversity>('universities', { limit: '6' })
      .then((result) => result.data)
      .catch(() => []),
    getCourses({ limit: '6' })
      .then((result) => result.data as unknown as HomeCourse[])
      .catch(() => []),
    phaseList<HomeScholarship>('scholarships', { limit: '6' }).catch(() => ({
      data: [] as HomeScholarship[],
      meta: null,
    })),
  ]);
  const scholarships = scholarshipList.data;
  /* A scholarship open to several destinations is counted once per destination
     in the directory, so the hero takes the distinct total from the list. */
  const scholarshipTotal = Number((scholarshipList.meta as { total?: unknown } | null)?.total);

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

  /* The design's popular searches, pointed at pages that exist: the popular
     guides, then the subjects students open most. */
  const popular: PopularLink[] = [
    ...directory.available
      .filter((entry) => entry.isPopular && entry.slug)
      .slice(0, 4)
      .map((entry) => ({ label: entry.name, href: `/study-abroad/${entry.slug}` })),
    ...subjects.slice(0, 2).map((subject) => ({ label: subject.name, href: `/subjects/${subject.slug}` })),
  ];

  /* The design's order, with the listing where its "countries" section sat.
     The bands alternate by position among what renders, so a preview that
     stands down never leaves two paper bands touching. */
  const rendered = [
    'paths',
    'directory',
    subjects.length ? 'subjects' : null,
    universities.length ? 'universities' : null,
    courses.length ? 'courses' : null,
    scholarships.length ? 'scholarships' : null,
    'support',
    'tools',
    'resources',
    'institutions',
    'trust',
  ].filter((id): id is string => Boolean(id));
  /* The hero is on paper, so it takes the first slot and the run after it
     starts on white; counted from the first section, paths sat on paper too
     and the two merged into one block. */
  const band = alternatingBands(['hero', ...rendered]);

  return (
    <>
      <HomeHero
        directory={directory}
        popular={popular}
        scholarshipTotal={Number.isFinite(scholarshipTotal) ? scholarshipTotal : undefined}
      />
      <StartPaths alt={band('paths')} />

      {/* The listing, where the design's own "countries" section sat. Its
          heading lives inside it rather than in a section of its own: split
          across two, the heading sat on paper while its cards sat on white,
          with a colour seam and 108px of nothing between a title and the
          thing it titles. */}
      <DirectoryView directory={directory} alt={band('directory')} />

      <HomeSubjects subjects={subjects} alt={band('subjects')} />
      <HomeUniversities universities={universities} alt={band('universities')} />
      <HomeCourses courses={courses} alt={band('courses')} />
      <HomeScholarships scholarships={scholarships} alt={band('scholarships')} />

      <HomeSupport alt={band('support')} />
      <HomeTools alt={band('tools')} />
      <HomeGuides alt={band('resources')} />
      <HomeInstitutions alt={band('institutions')} />
      <HomeTrust alt={band('trust')} />
      <PlanBand />
    </>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getCourseFilterOptions,
  getCourses,
  getSubjects,
} from '@/lib/catalog';
import { legacyCourseDiscoveryUrl } from '@/lib/course-discovery-url';
import { CoursesReference } from '@/components/reference/CoursesReference';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getListingPageContent } from '@/lib/listing-page-content';
import { phaseList } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

/** Stored enums such as IN_PERSON are internal; a reader sees "In person". */
function humanise(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
export async function generateMetadata() {
  return staticPageMetadata(
    'courses-listing',
    'Courses',
    'Search published courses by subject, level, study mode, intake, and country.',
    '/courses',
  );
}

type SearchParams = Record<string, string | string[] | undefined>;
const keys = [
  'q',
  'subject',
  'subSubject',
  'level',
  'country',
  'studyMode',
  'intake',
  'scholarshipAvailable',
  'englishTest',
  'postStudyWorkAvailable',
  'minTuition',
  'maxTuition',
  'sort',
  'page',
  'pageSize',
] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function unavailable() {
  return (
    <main className="error-page shell">
      <p className="eyebrow">Courses</p>
      <h1>Courses are temporarily unavailable</h1>
      <p>Please try again shortly.</p>
      <Link className="button" href="/courses">
        Retry
      </Link>
    </main>
  );
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    keys.flatMap((key) => {
      const value = one(raw[key]);
      return value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;
  if (!filters.pageSize) filters.pageSize = '12';

  // Preserve the generic catalog while giving the complete subject /
  // specialization / country / intake hierarchy one deterministic shareable URL.
  if (filters.subject && filters.subSubject && filters.country) {
    redirect(legacyCourseDiscoveryUrl(filters));
  }

  let catalog;
  try {
    catalog = await Promise.all([
      getCourses(filters),
      getSubjects({ limit: '100' }).then((result) => result.data),
      getCourseFilterOptions(filters),
    ]);
  } catch {
    return unavailable();
  }
  const [courses, subjects, filterOptions] = catalog;

  // Link clusters and the events strip are decoration around the listing, so a
  // failure there must not take the route down with it.
  const [universities, consultants, events, managed] = await Promise.all([
    phaseList<AnyRecord>('universities', { limit: '8' })
      .then((result) => result.data)
      .catch(() => []),
    phaseList<AnyRecord>('consultants', { limit: '8' })
      .then((result) => result.data)
      .catch(() => []),
    // `when=upcoming` matters: the strip is headed "Upcoming events", so a
    // past record must not appear in it.
    phaseList<AnyRecord>('events', { limit: '4', when: 'upcoming' })
      .then((result) => result.data)
      .catch(() => []),
    getListingPageContent('courses-listing'),
  ]);

  return (
    <CoursesReference
      courses={courses.data}
      meta={courses.meta}
      subjects={subjects}
      filterOptions={filterOptions}
      filters={filters}
      universities={universities.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
      }))}
      consultants={consultants.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
      }))}
      events={events.map((row) => ({
        name: String(row.title ?? row.name),
        slug: String(row.slug),
        mode: typeof row.eventType === 'string' ? humanise(row.eventType) : null,
        startAt: typeof row.startsAt === 'string' ? row.startsAt : null,
      }))}
      heading={managed.heading ?? 'Find the perfect course to'}
      headingAccent={managed.heading ? '' : 'study abroad'}
      lede={
        managed.lede ??
        'Explore published undergraduate, postgraduate, diploma and doctoral programmes. Compare tuition, intakes, study modes and entry requirements in one place.'
      }
      ctaHeading={managed.ctaHeading ?? 'Discover the right course for your future'}
      ctaBody={
        managed.ctaBody ??
        'Filter the published catalogue, shortlist the programmes that fit, and compare them side by side before you apply.'
      }
    />
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getCourseFilterOptions,
  getCourses,
  getSubjects,
} from '@/lib/catalog';
import { legacyCourseDiscoveryUrl } from '@/lib/course-discovery-url';
import { CoursesReference } from '@/components/reference/CoursesReference';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import { getListingPageContent } from '@/lib/listing-page-content';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const resolved = await staticPageMetadata(
    'courses-listing',
    'Courses',
    'Search published courses by subject, level, study mode, intake, and country.',
    '/courses',
  );
  /* This route family's layout appends the site name through its title
     template, and `staticPageMetadata` appends it too. */
  return { ...resolved, title: 'Courses' };
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
  /* Whether the reader chose a page or a page size themselves. The listing
     reveals twelve at a time on its own; an explicit choice means they are
     navigating the result set, and the pager has to appear for them. */
  const paged = Boolean(one(raw.page) || one(raw.pageSize));
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

  /* The approved page is the listing and the three closing bands, so the
     university, consultant and event clusters that fed the browse blocks are
     no longer read: three requests per view that nothing rendered. */
  const managed = await getListingPageContent('courses-listing');

  return (
    <>
    <CoursesReference
      courses={courses.data}
      meta={courses.meta}
      filterOptions={filterOptions}
      filters={filters}
      paged={paged}
      heading={managed.heading ?? 'Find your perfect course'}
      lede={
        managed.lede ??
        'Search by course, subject, specialization, university or country — then check whether it fits your profile.'
      }
    />
      <MatchBand
        heading="Narrowed it down?"
        lead="Tell us your profile and we'll show which of these you are a fit for."
        href="/contact"
      />
      {/* The approved page closes on the navy invitation before the related
          strip. It carries the managed CTA copy, which until now had a section
          of its own halfway up the page. */}
      <PlanBand
        heading={managed.ctaHeading ?? 'Not sure which country is right for you?'}
        body={
          managed.ctaBody ??
          "Tell us about your academic profile, goals and budget. We'll help you understand your options across every destination we cover."
        }
        secondary={{ href: '/study-abroad', label: 'Browse the directory' }}
      />
      <ConnectBand
        actions={[
          { href: '/subjects', label: 'Browse subjects' },
          { href: '/specializations', label: 'All specializations', ghost: true },
          { href: '/study-abroad', label: 'Compare destinations', ghost: true },
        ]}
        groups={[
          {
            title: 'Subjects',
            items: subjects.slice(0, 6).map((row) => ({
              id: String(row.id),
              name: String(row.name),
              href: `/subjects/${String(row.slug)}`,
            })),
          },
        ]}
      />
    </>
  );
}

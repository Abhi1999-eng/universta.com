import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getCourseFilterOptions,
  getCourses,
  getSubjects,
} from '@/lib/catalog';
import { legacyCourseDiscoveryUrl } from '@/lib/course-discovery-url';
import { ApprovedCoursesListing } from '@/components/templates/CourseCatalogTemplate';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
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
  return (
    <ApprovedCoursesListing
      courses={courses.data}
      meta={courses.meta}
      subjects={subjects}
      filterOptions={filterOptions}
      filters={filters}
    />
  );
}

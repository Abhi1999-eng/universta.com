import Link from 'next/link';
import { getCountries } from '@/lib/countries';
import { getCourseLevels, getCourses, getSubjects } from '@/lib/catalog';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { SubjectsReference } from '@/components/reference/SubjectsReference';
import { phaseList } from '@/lib/phase1';
import { formatNumber } from '@/lib/format';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return staticPageMetadata(
    'subjects-listing',
    'Subjects',
    'Explore published academic subjects and their available courses.',
    '/subjects',
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = one(params.q) ?? '';

  let catalog;
  try {
    catalog = await Promise.all([
      getSubjects({ q: query, page: one(params.page) ?? '1', limit: '100' }),
      getCourseLevels(),
      getCountries({ limit: '100' }).then((result) =>
        result.data.map((country) => ({
          id: country.id,
          name: country.name,
          slug: country.slug,
        })),
      ),
    ]);
  } catch {
    return (
      <main className="error-page shell">
        <p className="eyebrow">Subjects</p>
        <h1>Subjects are temporarily unavailable</h1>
        <p>Please try again shortly.</p>
        <Link className="button" href="/subjects">
          Retry
        </Link>
      </main>
    );
  }
  const [subjects, levels, countries] = catalog;

  // Cross-links around the subject list. Each falls back to an empty section
  // rather than taking the route down.
  const [universities, courses, scholarships] = await Promise.all([
    phaseList<AnyRecord>('universities', { limit: '4' }).catch(() => ({
      data: [] as AnyRecord[],
      meta: { total: 0 },
    })),
    getCourses({ pageSize: '6', sort: 'featured' }).catch(() => null),
    phaseList<AnyRecord>('scholarships', { limit: '3' }).catch(() => ({
      data: [] as AnyRecord[],
      meta: { total: 0 },
    })),
  ]);
  const universityMeta = universities.meta as { total?: number } | undefined;
  const scholarshipMeta = scholarships.meta as { total?: number } | undefined;

  return (
    <SubjectsReference
      subjects={subjects.data}
      meta={subjects.meta}
      query={query}
      levels={levels.map(({ id, name, code }) => ({ id, name, code }))}
      countries={countries}
      universities={universities.data.map((row) => ({
        name: String(row.name),
        slug: String(row.slug),
        country: row.country?.name ? String(row.country.name) : null,
      }))}
      courses={(courses?.data ?? []).map((course) => ({
        name: course.name,
        slug: course.slug,
        subject: course.subject.name,
        level: course.courseLevel.name,
      }))}
      scholarships={scholarships.data.map((row) => {
        const extra = row as Record<string, unknown>;
        const amount = extra.amount;
        return {
          title: String(row.title ?? row.name),
          slug: String(row.slug),
          amount:
            typeof amount === 'string' && amount
              ? `${typeof row.currencyCode === 'string' ? `${row.currencyCode} ` : ''}${formatNumber(amount)}`
              : null,
          type:
            typeof row.benefitType === 'string'
              ? row.benefitType.toLowerCase().replace(/_/g, ' ')
              : null,
        };
      })}
      totals={{
        // The subject records already carry the real per-subject course count,
        // so the catalogue total is their sum rather than a second query.
        courses: subjects.data.reduce((sum, subject) => sum + subject.publishedCourseCount, 0),
        universities: universityMeta?.total ?? universities.data.length,
        scholarships: scholarshipMeta?.total ?? scholarships.data.length,
      }}
    />
  );
}

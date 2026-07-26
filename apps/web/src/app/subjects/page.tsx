import Link from 'next/link';
import { getCountries } from '@/lib/countries';
import { getCourseLevels, getSubjects } from '@/lib/catalog';
import { ApprovedSubjectsListing } from '@/components/templates/AcademicTemplatePages';

export const dynamic = 'force-dynamic';

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
      getSubjects({
        q: query,
        page: one(params.page) ?? '1',
        limit: '100',
      }),
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
  return (
    <ApprovedSubjectsListing
      subjects={subjects.data}
      meta={subjects.meta}
      query={query}
      levels={levels}
      countries={countries}
    />
  );
}

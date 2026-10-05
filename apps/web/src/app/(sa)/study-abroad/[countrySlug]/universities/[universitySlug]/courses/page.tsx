import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { UniversityCourses } from '@/components/study-abroad/UniversityCourses';
import { intakeRange } from '@/lib/intake-range';
import { phaseList, phaseResolveRedirect } from '@/lib/phase1';
import { toScholarshipCards } from '@/lib/scholarship-card';
import {
  courseApiParams,
  courseListSearch,
  firstCity,
  readCourseFilters,
  toCountry,
  toCourseFacets,
  toOfferingCards,
} from '@/lib/university-courses';
import { loadCourseList } from '@/lib/university-courses-server';
import { universityCoursesHref } from '@/lib/university-links';

/**
 * Every course one university teaches, under its country:
 * /study-abroad/<country>/universities/<university>/courses.
 *
 * The filters, the sort and the page are all in the address, so the server
 * answers each of them and a filtered list can be shared. A wrong country in
 * the address is corrected with a permanent redirect rather than a second
 * copy of the page.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countrySlug: string; universitySlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type Row = Record<string, unknown>;

function apiSearch(raw: Record<string, string | string[] | undefined>) {
  return new URLSearchParams(courseApiParams(readCourseFilters(raw))).toString();
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { universitySlug } = await params;
  const result = await loadCourseList(universitySlug, apiSearch(await searchParams));
  const university = result?.university as Row | undefined;
  const country = toCountry(university?.country);
  if (!university || !country)
    return {
      title: { absolute: 'University courses not found | Universta' },
      robots: { index: false },
    };
  const name = String(university.name);
  const total = Number((result?.catalogue as Row | undefined)?.total ?? 0);
  const city = firstCity(university);
  return {
    /* The layout's template adds the site name. */
    title: `Courses at ${name} | Fees, Intakes & Entry Requirements`,
    description: total
      ? `${total} ${total === 1 ? 'course' : 'courses'} at ${name}${city ? `, ${city}` : ''}, ${country.name}: levels, durations, tuition, intakes and entry requirements, searchable and filterable.`
      : `Courses at ${name}, ${country.name}. None is in the Universta catalogue yet.`,
    alternates: {
      canonical: universityCoursesHref(country.slug, String(university.slug)),
    },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { countrySlug, universitySlug } = await params;
  const raw = await searchParams;
  const filters = readCourseFilters(raw);
  const result = await loadCourseList(universitySlug, apiSearch(raw));
  const university = result?.university as Row | undefined;
  const country = toCountry(university?.country);
  if (!result || !university || !country) {
    const moved = await phaseResolveRedirect(
      universityCoursesHref(countrySlug, universitySlug),
    );
    if (moved) permanentRedirect(moved.targetPath);
    notFound();
  }

  const slug = String(university.slug);
  if (country.slug !== countrySlug || slug !== universitySlug)
    permanentRedirect(
      `${universityCoursesHref(country.slug, slug)}${courseListSearch(filters, {
        page: filters.page,
      })}`,
    );

  const city = firstCity(university);
  const owner = { name: String(university.name), slug, country, city };
  const facets = toCourseFacets(result.facets);
  const catalogue = (result.catalogue as Row | undefined) ?? {};
  const meta = (result.meta as {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }) ?? { page: 1, limit: 18, total: 0, totalPages: 0 };
  const campusFacet = (result.facets as Row | undefined)?.campuses;

  /* Funding is a cross-link, not the point of the page: a failure here drops
     the section rather than the route. */
  const scholarships = await phaseList<AnyRecord>('scholarships', {
    university: slug,
    limit: '3',
  })
    .then((list) => toScholarshipCards(list.data))
    .catch(() => []);

  return (
    <UniversityCourses
      university={{
        name: owner.name,
        slug,
        websiteUrl:
          typeof university.websiteUrl === 'string' ? university.websiteUrl : null,
        country,
        city,
      }}
      filters={filters}
      facets={facets}
      cards={toOfferingCards(result.data, owner)}
      meta={meta}
      catalogueTotal={Number(catalogue.total ?? meta.total) || 0}
      campuses={Array.isArray(campusFacet) ? campusFacet.length : 0}
      deadlines={(Array.isArray(catalogue.deadlines) ? catalogue.deadlines : []).map(
        (entry: Row) => {
          const intake = (entry.intake as Row | undefined) ?? {};
          return {
            label: intakeRange({
              startMonth: intake.startMonth as number | null,
              endMonth: intake.endMonth as number | null,
              shortLabel: intake.shortLabel as string | null,
              name: intake.name as string | null,
            }),
            deadline: typeof entry.deadline === 'string' ? entry.deadline : null,
            count: Number(entry.count) || 0,
          };
        },
      )}
      scholarships={scholarships}
    />
  );
}

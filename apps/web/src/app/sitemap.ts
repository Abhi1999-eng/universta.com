import type { MetadataRoute } from "next";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseList, phaseListAll } from "@/lib/phase1";
import { getCountries } from "@/lib/countries";
import { getCountryCities } from "@/lib/locations";
import { getCourses, getSubjects } from "@/lib/catalog";
import { siteOrigin } from "@/lib/site-origin";
import { countryUniversitiesHref } from "@/lib/university-links";

const base = siteOrigin;
// Testimonials remain listing-only. Published success stories have a public
// long-form detail route and are included below.
const resources = [
  "universities",
  "scholarships",
  "consultants",
  "jobs",
  "events",
  "success-stories",
] as const;

/* How many destinations are asked about their universities at once. The
   API sheds load above roughly a dozen concurrent reads. */
const COUNT_CONCURRENCY = 5;

/**
 * The destinations with a published university, so each one's own list can
 * be announced.
 *
 * This was read off the universities list alone, which stops at 2,000 rows
 * in display order. With 9,761 universities, a destination whose
 * universities all fell after the two-thousandth got no list in the
 * sitemap. A destination the list already shows is taken as read; every
 * other one is asked for its own count, one row's worth, and a read that
 * fails leaves that destination out, as before.
 */
async function countriesWithUniversities(
  countrySlugs: string[],
  universities: AnyRecord[],
) {
  const seen = new Set(
    universities
      .map((row) => (row.country as { slug?: unknown } | undefined)?.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug !== ""),
  );
  const unseen = [...new Set(countrySlugs)].filter((slug) => !seen.has(slug));
  for (let from = 0; from < unseen.length; from += COUNT_CONCURRENCY) {
    const batch = unseen.slice(from, from + COUNT_CONCURRENCY);
    const totals = await Promise.all(
      batch.map((slug) =>
        phaseList<AnyRecord>("universities", { country: slug, limit: "1" })
          .then((result) =>
            Number((result.meta as { total?: unknown } | null)?.total),
          )
          .catch(() => 0),
      ),
    );
    batch.forEach((slug, index) => {
      if (totals[index]! > 0) seen.add(slug);
    });
  }
  return [...seen];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    // "/countries" redirects to "/study-abroad", which is now the canonical
    // destination directory. Listing both would put two URLs for the same
    // content in the sitemap.
    "/",
    "/study-abroad",
    "/about",
    "/contact",
    "/faq",
    "/subjects",
    "/courses",
    "/universities",
    "/scholarships",
    "/study-abroad-consultants",
    "/counselling",
    "/success-stories",
    "/testimonials",
    "/careers",
    "/events",
  ].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.7,
  }));
  try {
    const [
      [universities, scholarships, consultants, jobs, events, successStories],
      countries,
      subjects,
      courses,
    ] = await Promise.all([
      Promise.all(
        resources.map((resource) => phaseListAll<AnyRecord>(resource)),
      ),
      getCountries({ limit: "100" }),
      getSubjects({ limit: "100" }),
      getCourses({ limit: "100" }),
    ]);
    const citiesByCountry = await Promise.all(
      countries.data.map((country) =>
        getCountryCities(country.slug, { limit: "50" }).catch(() => ({
          data: [] as Array<{ slug: string }>,
        })),
      ),
    );
    const universityLists = await countriesWithUniversities(
      countries.data.map((country) => country.slug),
      universities.data,
    );
    const dynamicRoutes = [
      ...universities.data.map((row) => `/universities/${row.slug}`),
      ...scholarships.data.map((row) => `/scholarships/${row.slug}`),
      ...consultants.data.map((row) => `/study-abroad-consultants/${row.slug}`),
      ...jobs.data.map((row) => `/careers/${row.slug}`),
      ...events.data.map((row) => `/events/${row.slug}`),
      ...successStories.data.map((row) => `/success-stories/${row.slug}`),
      /* The canonical country guide lives under /study-abroad; /countries/<slug>
         permanently redirects there, so only the target is listed. */
      ...countries.data.map((row) => `/study-abroad/${row.slug}`),
      /* Each destination's own list of universities -- but only where a
         published university says there is one, so no empty list is
         announced. */
      ...universityLists.map((slug) => countryUniversitiesHref(slug)),
      ...countries.data.flatMap((country, index) =>
        citiesByCountry[index].data.map(
          (city) => `/study-in-${country.slug}/${city.slug}`,
        ),
      ),
      ...subjects.data.map((row) => `/subjects/${row.slug}`),
      ...courses.data.map((row) => `/courses/${row.slug}`),
    ].map((path) => ({
      url: new URL(path, base).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    return staticRoutes;
  }
}

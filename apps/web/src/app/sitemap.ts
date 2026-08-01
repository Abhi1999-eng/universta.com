import type { MetadataRoute } from "next";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseList } from "@/lib/phase1";
import { getCountries } from "@/lib/countries";
import { getCountryCities } from "@/lib/locations";
import { getCourses, getSubjects } from "@/lib/catalog";
import { siteOrigin } from "@/lib/site-origin";

const base = siteOrigin;
// success-stories and testimonials are listing-only — there is no
// success-stories/[slug] or testimonials/[slug] detail route, so neither
// belongs in the dynamic-routes list below (a prior version generated dead
// success-stories detail URLs that all 404).
const resources = [
  "universities",
  "scholarships",
  "consultants",
  "jobs",
  "events",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    // "/countries" now redirects to "/", which serves that same content as
    // the homepage -- listing both here would put two canonical URLs for
    // identical content in the sitemap.
    "/",
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
      [universities, scholarships, consultants, jobs, events],
      countries,
      subjects,
      courses,
    ] = await Promise.all([
      Promise.all(
        resources.map((resource) => phaseList<AnyRecord>(resource, { limit: "50" })),
      ),
      getCountries({ limit: "50" }),
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
    const dynamicRoutes = [
      ...universities.data.map((row) => `/universities/${row.slug}`),
      ...scholarships.data.map((row) => `/scholarships/${row.slug}`),
      ...consultants.data.map((row) => `/study-abroad-consultants/${row.slug}`),
      ...jobs.data.map((row) => `/careers/${row.slug}`),
      ...events.data.map((row) => `/events/${row.slug}`),
      ...countries.data.map((row) => `/study-in-${row.slug}`),
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

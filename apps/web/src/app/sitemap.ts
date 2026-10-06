import type { MetadataRoute } from "next";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import {
  phaseList,
  phaseListAll,
  phaseProgrammeAddresses,
  type ProgrammeAddress,
} from "@/lib/phase1";
import { getCountries } from "@/lib/countries";
import { getCountryCities } from "@/lib/locations";
import { getCourses, getSubjects } from "@/lib/catalog";
import { siteOrigin } from "@/lib/site-origin";
import {
  countryUniversitiesHref,
  offeringHref,
  universityCoursesHref,
} from "@/lib/university-links";

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

/* The catalogue lists serve a hundred rows a page at most. */
const CATALOGUE_PAGE = 100;
/* The programme addresses come five thousand to a page, and a sitemap
   holds fifty thousand addresses: past ten pages the programmes would
   need sitemaps of their own (generateSitemaps), which is far beyond the
   catalogue today. */
const ADDRESS_PAGE = 5000;
const ADDRESS_PAGES = 10;

/**
 * Every row of a paged list, not the first page of it.
 *
 * The destinations and the course guides were read a hundred at a time and
 * only the first hundred were announced: 100 of 206 destinations and 100
 * of 299 courses. The first page says how many there are; the rest are
 * read a few at a time, as the API asks. A page that fails fails the read,
 * as the single page did before.
 */
async function everyPage<T>(
  read: (params: Record<string, string>) => Promise<{ data: T[]; meta: unknown }>,
  limit: number,
  cap = Infinity,
) {
  const page = (n: number) => read({ limit: String(limit), page: String(n) });
  const first = await page(1);
  const totalPages = Number(
    (first.meta as { totalPages?: unknown } | null)?.totalPages,
  );
  const pages = Math.min(
    Number.isFinite(totalPages) && totalPages > 1 ? totalPages : 1,
    cap,
  );
  const rest: T[] = [];
  for (let from = 2; from <= pages; from += COUNT_CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(COUNT_CONCURRENCY, pages - from + 1) }, (_, index) =>
        page(from + index),
      ),
    );
    rest.push(...batch.flatMap((result) => result.data));
  }
  return [...first.data, ...rest];
}

/**
 * Each live programme's page, and each university's course list that has
 * one -- the indexable pages the course catalogue is made of, which the
 * sitemap never announced. A university with no programme has no list
 * worth announcing. The programmes are an addition to the sitemap, so a
 * failure to read them costs them alone.
 */
async function programmeRoutes() {
  const addresses = await everyPage<ProgrammeAddress>(
    phaseProgrammeAddresses,
    ADDRESS_PAGE,
    ADDRESS_PAGES,
  ).catch(() => [] as ProgrammeAddress[]);
  const lists = new Set<string>();
  const pages = addresses.map((row) => {
    lists.add(universityCoursesHref(row.countrySlug, row.universitySlug));
    return offeringHref(row.countrySlug, row.universitySlug, row.slug);
  });
  return [...lists, ...pages];
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
      programmes,
    ] = await Promise.all([
      Promise.all(
        resources.map((resource) => phaseListAll<AnyRecord>(resource)),
      ),
      everyPage(getCountries, CATALOGUE_PAGE),
      getSubjects({ limit: "100" }),
      everyPage(getCourses, CATALOGUE_PAGE),
      programmeRoutes(),
    ]);
    /* A few destinations at a time: with every destination listed there
       are twice as many of these reads, and all at once the API would shed
       most of them -- each lost one silently dropping its cities. */
    const citiesByCountry: Array<{ data: Array<{ slug: string }> }> = [];
    for (let from = 0; from < countries.length; from += COUNT_CONCURRENCY)
      citiesByCountry.push(
        ...(await Promise.all(
          countries.slice(from, from + COUNT_CONCURRENCY).map((country) =>
            getCountryCities(country.slug, { limit: "50" }).catch(() => ({
              data: [] as Array<{ slug: string }>,
            })),
          ),
        )),
      );
    const universityLists = await countriesWithUniversities(
      countries.map((country) => country.slug),
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
      ...countries.map((row) => `/study-abroad/${row.slug}`),
      /* Each destination's own list of universities -- but only where a
         published university says there is one, so no empty list is
         announced. */
      ...universityLists.map((slug) => countryUniversitiesHref(slug)),
      ...countries.flatMap((country, index) =>
        citiesByCountry[index].data.map(
          (city) => `/study-in-${country.slug}/${city.slug}`,
        ),
      ),
      ...subjects.data.map((row) => `/subjects/${row.slug}`),
      ...courses.map((row) => `/courses/${row.slug}`),
      /* Each university's course list, where it lists a programme, and
         each programme's page, at its nested address. */
      ...programmes,
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

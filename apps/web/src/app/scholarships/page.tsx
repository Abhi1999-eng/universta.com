import { getListingPageContent } from "@/lib/listing-page-content";
import type { ListingMeta } from "@/components/templates/PolishedListing";
import type { ScholarshipRow } from "@/components/templates/ListingCards";
import { ScholarshipsReference } from "@/components/reference/ScholarshipsReference";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { getCountries } from "@/lib/countries";
import { getCourseLevels, getSubjects } from "@/lib/catalog";
import { phaseList } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "scholarships-listing",
    "Scholarships",
    "Explore currently published scholarships and their eligibility details.",
    "/scholarships",
  );
}

/** Only the keys the scholarships list endpoint actually honours. */
const SUPPORTED = [
  "q", "country", "university", "offering", "subject",
  "degreeLevel", "type", "amountMin", "amountMax", "deadline", "sort", "page",
] as const;

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = Object.fromEntries(
    SUPPORTED.flatMap((key) => {
      const value = raw[key];
      return typeof value === "string" && value ? [[key, value]] : [];
    }),
  ) as Record<string, string>;

  let rows: ScholarshipRow[] = [];
  let meta: ListingMeta = { page: 1, limit: 12, total: 0, totalPages: 0 };
  let countries: Array<{ name: string; slug: string }> = [];
  let subjects: Array<{ name: string; slug: string }> = [];
  let levels: Array<{ name: string; code: string }> = [];
  let universities: Array<{ name: string; slug: string }> = [];
  try {
    const [result, countryList, subjectList, levelList, uniList] = await Promise.all([
      phaseList<AnyRecord>("scholarships", { limit: "12", ...filters }),
      getCountries({ limit: "100" }).then((r) => r.data).catch(() => []),
      getSubjects({ limit: "100" }).then((r) => r.data).catch(() => []),
      getCourseLevels().catch(() => []),
      phaseList<AnyRecord>("universities", { limit: "100" }).then((r) => r.data).catch(() => []),
    ]);
    rows = result.data as unknown as ScholarshipRow[];
    meta = result.meta as ListingMeta;
    countries = countryList.map((c) => ({ name: c.name, slug: c.slug }));
    subjects = subjectList.map((s) => ({ name: s.name, slug: s.slug }));
    levels = levelList.map((l) => ({ name: l.name, code: l.code }));
    universities = uniList.map((u) => ({ name: String(u.name), slug: String(u.slug) }));
  } catch {
    // Honest empty state rather than a failed route.
  }

  const benefitTypes = [...new Set(rows.map((row) => row.benefitType).filter(Boolean))] as string[];

  // Editorial framing from the managed "scholarships-listing" Page. Rows are
  // untouched -- they always come from the real records.
  const managed = await getListingPageContent("scholarships-listing");

  return (
    <ScholarshipsReference
      rows={rows}
      meta={meta}
      filters={filters}
      countries={countries.map((c) => ({ value: c.slug, label: c.name }))}
      subjects={subjects.map((sub) => ({ value: sub.slug, label: sub.name }))}
      levels={levels.map((l) => ({ value: l.code, label: l.name }))}
      universities={universities.map((u) => ({ value: u.slug, label: u.name }))}
      benefitTypes={benefitTypes.map((t) => ({
        value: t,
        label: t.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      }))}
      totals={{
        scholarships: meta.total,
        countries: countries.length,
        universities: universities.length,
      }}
      heading={managed.heading ?? "Find scholarships to fund your"}
      headingAccent={managed.heading ? "" : "study abroad journey"}
      lede={
        managed.lede ??
        "Filter published scholarships by destination, university, degree, subject and funding type to find a relevant opportunity."
      }
    />
  );
}

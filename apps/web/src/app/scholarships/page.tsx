import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import {
  PolishedListing,
  type FilterGroup,
  type ListingMeta,
} from "@/components/templates/PolishedListing";
import {
  ScholarshipCard,
  type ScholarshipRow,
} from "@/components/templates/ListingCards";
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

const SORTS = [
  { value: "featured", label: "Featured first" },
  { value: "deadline", label: "Deadline (soonest)" },
  { value: "amount-desc", label: "Award (highest)" },
  { value: "amount-asc", label: "Award (lowest)" },
  { value: "name-asc", label: "Title (A–Z)" },
];

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

  const filterGroups: FilterGroup[] = [
    { key: "country", label: "Country", kind: "select", options: countries.map((c) => ({ value: c.slug, label: c.name })) },
    { key: "university", label: "University", kind: "select", options: universities.map((u) => ({ value: u.slug, label: u.name })) },
    { key: "subject", label: "Subject", kind: "select", options: subjects.map((s) => ({ value: s.slug, label: s.name })) },
    { key: "degreeLevel", label: "Degree level", kind: "select", options: levels.map((l) => ({ value: l.code, label: l.name })) },
    { key: "type", label: "Scholarship type", kind: "select", options: benefitTypes.map((t) => ({ value: t, label: t })) },
    { key: "amountMin", label: "Minimum award", kind: "number", placeholder: "e.g. 1000" },
    { key: "amountMax", label: "Maximum award", kind: "number", placeholder: "e.g. 20000" },
    { key: "deadline", label: "Only open deadlines", kind: "toggle", onValue: "open" },
  ];

  return (
    <PolishedListing
      eyebrow="Published directory"
      heading="Find a"
      headingAccent="scholarship"
      lede="Search published scholarships, then narrow by destination, level and award to the ones you may be eligible for."
      crumbLabel="Scholarships"
      basePath="/scholarships"
      noun={{ one: "scholarship", many: "scholarships" }}
      searchLabel="Search scholarships"
      searchPlaceholder="Search scholarships by title…"
      filterGroups={filterGroups}
      sortOptions={SORTS}
      filters={filters}
      meta={meta}
      resultsOnPage={rows.length}
      emptyTitle="No scholarships match these filters"
      emptyBody="Clear one or more filters to return to the published directory."
      ctaHeading="Need help finding funding?"
      ctaBody="A counsellor can help you match your profile to published scholarships."
      railHeading="Check before you apply"
      railBody="Eligibility, amounts and deadlines are set by the provider. Always confirm directly with them."
      counsellingSource="general"
    >
      {rows.map((row) => (
        <ScholarshipCard row={row} key={row.id} />
      ))}
    </PolishedListing>
  );
}

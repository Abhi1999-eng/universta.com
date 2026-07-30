import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import {
  PolishedListing,
  type FilterGroup,
  type ListingMeta,
} from "@/components/templates/PolishedListing";
import {
  UniversityCard,
  type UniversityRow,
} from "@/components/templates/ListingCards";
import { getCountries } from "@/lib/countries";
import { getSubjects } from "@/lib/catalog";
import { phaseList } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "universities-listing",
    "Universities",
    "Explore currently published universities and their study options.",
    "/universities",
  );
}

/** Only the keys the universities list endpoint actually honours. Anything
 * else in the URL is ignored rather than silently passed through. */
const SUPPORTED = ["q", "country", "type", "subject", "city", "state", "sort", "page"] as const;

const SORTS = [
  { value: "featured", label: "Featured first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "newest", label: "Recently published" },
];

export default async function UniversitiesPage({
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

  let rows: UniversityRow[] = [];
  let meta: ListingMeta = { page: 1, limit: 12, total: 0, totalPages: 0 };
  let countries: Array<{ name: string; slug: string }> = [];
  let subjects: Array<{ name: string; slug: string }> = [];
  try {
    const [result, countryList, subjectList] = await Promise.all([
      phaseList<AnyRecord>("universities", { limit: "12", ...filters }),
      getCountries({ limit: "100" }).then((r) => r.data).catch(() => []),
      getSubjects({ limit: "100" }).then((r) => r.data).catch(() => []),
    ]);
    rows = result.data as unknown as UniversityRow[];
    meta = result.meta as ListingMeta;
    countries = countryList.map((c) => ({ name: c.name, slug: c.slug }));
    subjects = subjectList.map((s) => ({ name: s.name, slug: s.slug }));
  } catch {
    // Leaves the honest empty state rendered rather than failing the route.
  }

  const institutionTypes = [...new Set(rows.map((row) => row.institutionType).filter(Boolean))] as string[];

  const filterGroups: FilterGroup[] = [
    {
      key: "country",
      label: "Country",
      kind: "select",
      options: countries.map((c) => ({ value: c.slug, label: c.name })),
    },
    {
      key: "subject",
      label: "Subject",
      kind: "select",
      options: subjects.map((s) => ({ value: s.slug, label: s.name })),
    },
    {
      key: "type",
      label: "Institution type",
      kind: "select",
      options: institutionTypes.map((t) => ({ value: t, label: t })),
    },
    { key: "state", label: "State / province", kind: "text", placeholder: "e.g. Ontario" },
    { key: "city", label: "City", kind: "text", placeholder: "e.g. Toronto" },
  ];

  return (
    <PolishedListing
      eyebrow="Published directory"
      heading="Find your"
      headingAccent="university"
      lede="Search published universities, then filter by destination, subject and location to shortlist the ones worth a closer look."
      crumbLabel="Universities"
      basePath="/universities"
      noun={{ one: "university", many: "universities" }}
      searchLabel="Search universities"
      searchPlaceholder="Search universities by name…"
      filterGroups={filterGroups}
      sortOptions={SORTS}
      filters={filters}
      meta={meta}
      emptyTitle="No universities match these filters"
      emptyBody="Clear one or more filters to return to the published directory."
      ctaHeading="Not sure which university fits?"
      ctaBody="Talk through your shortlist with a counsellor before you apply."
      railHeading="Shortlist with confidence"
      railBody="Verify tuition, entry requirements and intakes with the university before deciding."
      counsellingSource="general"
    >
      {rows.map((row) => (
        <UniversityCard row={row} key={row.id} />
      ))}
    </PolishedListing>
  );
}

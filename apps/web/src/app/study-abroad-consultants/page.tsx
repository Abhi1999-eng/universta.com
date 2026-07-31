import { getListingPageContent } from "@/lib/listing-page-content";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import {
  PolishedListing,
  type FilterGroup,
  type ListingMeta,
} from "@/components/templates/PolishedListing";
import {
  ConsultantCard,
  type ConsultantRow,
} from "@/components/templates/ListingCards";
import { getCountries } from "@/lib/countries";
import { phaseList } from "@/lib/phase1";
import { staticPageMetadata } from "@/lib/static-page-seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return staticPageMetadata(
    "consultants-listing",
    "Study abroad consultants",
    "Explore currently published study abroad consultants, their locations and services.",
    "/study-abroad-consultants",
  );
}

/** Only the keys the consultants list endpoint actually honours. */
const SUPPORTED = [
  "q", "country", "region", "state", "city",
  "location", "service", "language", "verified", "sort", "page",
] as const;

const SORTS = [
  { value: "featured", label: "Featured first" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "newest", label: "Recently published" },
];

export default async function ConsultantsPage({
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

  let rows: ConsultantRow[] = [];
  let meta: ListingMeta = { page: 1, limit: 12, total: 0, totalPages: 0 };
  let countries: Array<{ name: string; slug: string }> = [];
  try {
    const [result, countryList] = await Promise.all([
      phaseList<AnyRecord>("consultants", { limit: "12", ...filters }),
      getCountries({ limit: "100" }).then((r) => r.data).catch(() => []),
    ]);
    rows = result.data as unknown as ConsultantRow[];
    meta = result.meta as ListingMeta;
    countries = countryList.map((c) => ({ name: c.name, slug: c.slug }));
  } catch {
    // Honest empty state rather than a failed route.
  }

  // Service, language and location options come from the published records
  // themselves, so the sidebar can never offer a value that returns nothing.
  const services = [...new Set(rows.flatMap((r) => (r.services ?? []).map((s) => s.serviceName ?? s.name)).filter(Boolean))] as string[];
  const languages = [...new Set(rows.flatMap((r) => (r.languages ?? []).map((l) => l.languageName ?? l.language)).filter(Boolean))] as string[];
  const locations = [
    ...new Map(
      rows
        .flatMap((r) => (r.locations ?? []).map((entry) => entry.location))
        .filter((location): location is { name?: string | null; slug?: string | null } => Boolean(location?.slug))
        .map((location) => [location.slug as string, location]),
    ).values(),
  ];

  const filterGroups: FilterGroup[] = [
    { key: "country", label: "Destination country", kind: "select", options: countries.map((c) => ({ value: c.slug, label: c.name })) },
    { key: "location", label: "Consultant location", kind: "select", options: locations.map((l) => ({ value: String(l.slug), label: l.name ?? String(l.slug) })) },
    { key: "service", label: "Service", kind: "select", options: services.map((s) => ({ value: s, label: s })) },
    { key: "language", label: "Language", kind: "select", options: languages.map((l) => ({ value: l, label: l })) },
    { key: "region", label: "Region", kind: "text", placeholder: "e.g. Ontario" },
    { key: "state", label: "State / province", kind: "text", placeholder: "e.g. Ontario" },
    { key: "city", label: "City", kind: "text", placeholder: "e.g. Toronto" },
    { key: "verified", label: "Verified consultants only", kind: "toggle", onValue: "true" },
  ];

  // Editorial framing from the managed "consultants-listing" Page. Rows above are
  // untouched -- they always come from the real records.
  const managed = await getListingPageContent("consultants-listing");

  return (
    <PolishedListing
      eyebrow="Published directory"
      heading={managed.heading ?? "Find a study abroad"}
      headingAccent={managed.heading ? "" : "consultant"}
      lede={managed.lede ?? "Browse published consultants by location, service and language, then contact them directly."}
      crumbLabel="Consultants"
      basePath="/study-abroad-consultants"
      noun={{ one: "consultant", many: "consultants" }}
      searchLabel="Search consultants"
      searchPlaceholder="Search consultants by name…"
      filterGroups={filterGroups}
      sortOptions={SORTS}
      filters={filters}
      meta={meta}
      resultsOnPage={rows.length}
      emptyTitle="No consultants match these filters"
      emptyBody="Clear one or more filters to return to the published directory."
      ctaHeading={managed.ctaHeading ?? "Prefer to start with a counsellor?"}
      ctaBody={managed.ctaBody ?? "Book a free session and we will point you to the right next step."}
      railHeading="How listings work"
      railBody="Listings are published records only. Verification reflects the status stored on each profile, not an endorsement."
      counsellingSource="general"
    >
      {rows.map((row) => (
        <ConsultantCard row={row} key={row.id} />
      ))}
    </PolishedListing>
  );
}

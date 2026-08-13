import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CountryDetailReference,
  type ScholarshipSummary,
  type UniversitySummary,
} from "@/components/reference/CountryDetailReference";
import type { AnyRecord } from "@/components/phase1/PhaseOneViews";
import { getCountryPage } from "@/lib/countries";
import { getCourseFilterOptions } from "@/lib/catalog";
import { getCountryCities } from "@/lib/locations";
import { phaseList } from "@/lib/phase1";
import { jsonLdString } from "@/lib/json-ld";
import { formatNumber } from "@/lib/format";
import { resolvedMetadata } from "@/lib/seo-management";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  try {
    return await getCountryPage(slug);
  } catch {
    return null;
  }
}

async function loadCities(slug: string) {
  try {
    return (await getCountryCities(slug, { limit: "6" })).data;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).slug);
  if (!page) return { title: "Country not found | Universta" };
  return resolvedMetadata(
    page.seo,
    page.country.pageHeading,
    page.country.shortDescription,
    `/countries/${page.country.slug}`,
  );
}

export default async function CountryDetailPage({ params }: Props) {
  const slug = (await params).slug;
  const page = await load(slug);
  if (!page) notFound();
  // Everything below decorates the country profile. A failure in any one of
  // them drops its section rather than taking the destination page down.
  const [cities, universities, scholarships, filterOptions] = await Promise.all(
    [
      loadCities(slug),
      phaseList<AnyRecord>("universities", { country: slug, limit: "4" }).catch(
        () => ({
          data: [] as AnyRecord[],
          meta: { total: 0 },
        }),
      ),
      phaseList<AnyRecord>("scholarships", { country: slug, limit: "6" }).catch(
        () => ({
          data: [] as AnyRecord[],
          meta: { total: 0 },
        }),
      ),
      getCourseFilterOptions({ country: slug }).catch(() => null),
    ],
  );
  const universityMeta = universities.meta as { total?: number } | undefined;
  const scholarshipMeta = scholarships.meta as { total?: number } | undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: page.country.name,
    description: page.country.shortDescription,
    url: `/countries/${page.country.slug}`,
  };
  const faqJsonLd = page.faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;
  return (
    <>
      <CountryDetailReference
        page={page}
        cities={cities}
        universities={universities.data.map((row): UniversitySummary => ({
          name: String(row.name),
          slug: String(row.slug),
          city: typeof row.location === "string" ? row.location : null,
          institutionType:
            typeof row.institutionType === "string"
              ? row.institutionType
              : null,
          verified: row.verificationStatus === "VERIFIED",
        }))}
        universityTotal={universityMeta?.total ?? universities.data.length}
        scholarships={scholarships.data.map((row): ScholarshipSummary => {
          // `amount` and `degreeLevel` are scholarship-only fields that the
          // shared AnyRecord shape does not declare.
          const extra = row as Record<string, unknown>;
          const amount = extra.amount;
          const level = extra.degreeLevel;
          return {
            title: String(row.title ?? row.name),
            slug: String(row.slug),
            summary: typeof row.summary === "string" ? row.summary : null,
            amount:
              typeof amount === "string" && amount
                ? `${typeof row.currencyCode === "string" ? `${row.currencyCode} ` : ""}${formatNumber(amount)}`
                : null,
            level: typeof level === "string" ? level : null,
            deadline: typeof row.deadline === "string" ? row.deadline : null,
          };
        })}
        scholarshipTotal={scholarshipMeta?.total ?? scholarships.data.length}
        subjects={filterOptions?.subjects.slice(0, 8) ?? []}
        courseTotal={
          filterOptions?.subjects.reduce(
            (sum, subject) => sum + subject.count,
            0,
          ) ?? 0
        }
      />
      <script type="application/ld+json">{jsonLdString(jsonLd)}</script>
      {faqJsonLd ? (
        <script type="application/ld+json">{jsonLdString(faqJsonLd)}</script>
      ) : null}
    </>
  );
}

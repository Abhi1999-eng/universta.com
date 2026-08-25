import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { ConsultantDetailReference } from "@/components/reference/ConsultantDetailReference";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";
import { resolveContentVariables } from "../../../../../../packages/content-variables";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function consultant(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("consultants", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await consultant(slug);
  return row
    ? phaseOneMetadata(row, `/study-abroad-consultants/${row.slug ?? slug}`, "Study abroad consultant")
    : { title: "Consultant not found | Universta", robots: { index: false } };
}

export default async function ConsultantPage({ params }: Props) {
  const { slug } = await params;
  const row = await consultant(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/study-abroad-consultants/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const record = row as unknown as Record<string, unknown>;
  const list = (value: unknown, key: 'country' | 'location' | null) =>
    Array.isArray(value)
      ? value.map((entry) => {
          const item = entry as Record<string, unknown>;
          const nested = key ? (item[key] as Record<string, unknown> | undefined) : item;
          return { item, nested };
        })
      : [];

  return (
    <ConsultantDetailReference
      consultant={{
        name: String(record.name),
        slug: String(record.slug),
        shortDescription:
          typeof record.shortDescription === "string" ? record.shortDescription : null,
        description: typeof record.description === "string" ? resolveContentVariables("consultant", record.description, record) : null,
        email: typeof record.email === "string" ? record.email : null,
        phone: typeof record.phone === "string" ? record.phone : null,
        websiteUrl: typeof record.websiteUrl === "string" ? record.websiteUrl : null,
        verified: record.verificationStatus === "VERIFIED",
        verifiedAt: typeof record.verifiedAt === "string" ? record.verifiedAt : null,
        sourceReference:
          typeof record.sourceReference === "string" ? record.sourceReference : null,
      }}
      countries={list(record.countries, "country")
        .filter(({ nested }) => nested?.slug)
        .map(({ nested }) => ({ name: String(nested!.name), slug: String(nested!.slug) }))}
      services={list(record.services, null)
        .map(({ nested }) => (nested?.name ? String(nested.name) : ""))
        .filter(Boolean)}
      languages={list(record.languages, null)
        .map(({ nested }) => (nested?.name ? String(nested.name) : ""))
        .filter(Boolean)}
      locations={list(record.locations, "location")
        .filter(({ nested }) => nested?.slug)
        .map(({ item, nested }) => {
          const country = nested!.country as Record<string, unknown> | undefined;
          return {
            name: String(nested!.name),
            slug: String(nested!.slug),
            city: nested!.city ? String(nested!.city) : null,
            /* State and country are published on the location too. Rendering
             * them turns a bare office name into a place a reader recognises. */
            state: nested!.state ? String(nested!.state) : null,
            country: country?.name ? String(country.name) : null,
            address: typeof item.address === "string" ? item.address : null,
          };
        })}
    />
  );
}

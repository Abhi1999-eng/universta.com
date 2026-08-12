import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { ConsultantLocationReference } from "@/components/reference/ConsultantLocationReference";
import { phaseLocation } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locationSlug: string }> };

async function consultantLocation(slug: string) {
  try {
    return await phaseLocation<AnyRecord>(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locationSlug } = await params;
  const row = await consultantLocation(locationSlug);
  return row
    ? phaseOneMetadata(row, `/study-abroad-consultants/locations/${row.slug ?? locationSlug}`, "Consultant location")
    : { title: "Consultant location not found | Universta", robots: { index: false } };
}

export default async function ConsultantLocationPage({ params }: Props) {
  const { locationSlug } = await params;
  const row = await consultantLocation(locationSlug);
  if (!row) notFound();
  const record = row as unknown as Record<string, unknown>;
  const country = record.country as Record<string, unknown> | undefined;
  const links = Array.isArray(record.consultants)
    ? (record.consultants as Array<Record<string, unknown>>)
    : [];

  const names = (value: unknown, key: "country" | null) =>
    Array.isArray(value)
      ? (value as Array<Record<string, unknown>>)
          .map((entry) => {
            const nested = key
              ? (entry[key] as Record<string, unknown> | undefined)
              : entry;
            return nested?.name ? String(nested.name) : "";
          })
          .filter(Boolean)
      : [];

  return (
    <ConsultantLocationReference
      location={{
        name: String(record.name),
        slug: String(record.slug),
        city: typeof record.city === "string" ? record.city : null,
        state: typeof record.state === "string" ? record.state : null,
        overview: typeof record.overview === "string" ? record.overview : null,
        country: country?.slug
          ? { name: String(country.name), slug: String(country.slug) }
          : null,
      }}
      consultants={links
        .map((link) => link.consultant as Record<string, unknown> | undefined)
        .filter(Boolean)
        .map((consultant) => ({
          name: String(consultant!.name),
          slug: String(consultant!.slug),
          shortDescription:
            typeof consultant!.shortDescription === "string"
              ? consultant!.shortDescription
              : null,
          verified: consultant!.verificationStatus === "VERIFIED",
          countries: names(consultant!.countries, "country"),
          services: names(consultant!.services, null),
        }))}
    />
  );
}

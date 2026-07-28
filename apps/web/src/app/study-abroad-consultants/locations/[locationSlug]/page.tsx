import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
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
  return (
    <PhaseDetail
      resource="consultants"
      row={row}
      parent={["Consultants", "/study-abroad-consultants"]}
    />
  );
}

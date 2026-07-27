import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseLocation } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function consultantLocation(slug: string) {
  try {
    return await phaseLocation<AnyRecord>(slug);
  } catch {
    notFound();
  }
}

export default async function ConsultantLocationPage({
  params,
}: {
  params: Promise<{ locationSlug: string }>;
}) {
  const row = await consultantLocation((await params).locationSlug);
  return (
    <PhaseDetail
      resource="consultants"
      row={row}
      parent={["Consultants", "/study-abroad-consultants"]}
    />
  );
}

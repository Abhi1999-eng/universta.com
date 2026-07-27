import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function consultant(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("consultants", slug);
  } catch {
    notFound();
  }
}

export default async function ConsultantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await consultant((await params).slug);
  return <PhaseDetail resource="consultants" row={row} />;
}

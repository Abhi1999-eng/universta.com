import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function scholarship(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("scholarships", slug);
  } catch {
    notFound();
  }
}

export default async function ScholarshipPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await scholarship((await params).slug);
  return <PhaseDetail resource="scholarships" row={row} />;
}

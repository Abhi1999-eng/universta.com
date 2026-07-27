import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function job(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("jobs", slug);
  } catch {
    notFound();
  }
}

export default async function JobPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await job((await params).slug);
  return <PhaseDetail resource="jobs" row={row} />;
}

import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";

export const dynamic = "force-dynamic";

async function event(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("events", slug);
  } catch {
    notFound();
  }
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const row = await event((await params).slug);
  return <PhaseDetail resource="events" row={row} />;
}

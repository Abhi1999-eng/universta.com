import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function event(slug: string) {
  try {
    return await phaseDetail<AnyRecord>("events", slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await event(slug);
  return row
    ? phaseOneMetadata(row, `/events/${row.slug ?? slug}`, "Event")
    : { title: "Event not found | Universta", robots: { index: false } };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const row = await event(slug);
  if (!row) notFound();
  return <PhaseDetail resource="events" row={row} />;
}

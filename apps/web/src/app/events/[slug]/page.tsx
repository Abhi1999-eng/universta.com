import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PhaseDetail, type AnyRecord } from "@/components/phase1/PhaseOneViews";
import { phaseDetail, phaseResolveRedirect } from "@/lib/phase1";
import { phaseOneMetadata } from "@/lib/phase1-metadata";
import { jsonLdString } from "@/lib/json-ld";

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

function eventJsonLd(row: AnyRecord) {
  const isOnline = row.eventType === "ONLINE";
  const isHybrid = row.eventType === "HYBRID";
  const venue = row.venue
    ? { "@type": "Place", name: row.venue }
    : undefined;
  const virtual = row.onlineUrl
    ? { "@type": "VirtualLocation", url: row.onlineUrl }
    : undefined;
  const location = isHybrid
    ? [venue, virtual].filter(Boolean)
    : isOnline
      ? virtual
      : venue;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: row.title,
    description: row.description ?? row.summary ?? row.title,
    startDate: row.startsAt,
    endDate: row.endsAt ?? undefined,
    eventAttendanceMode: isOnline
      ? "https://schema.org/OnlineEventAttendanceMode"
      : isHybrid
        ? "https://schema.org/MixedEventAttendanceMode"
        : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location,
    organizer: { "@type": "Organization", name: "Universta" },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const row = await event(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/events/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return (
    <>
      <PhaseDetail resource="events" row={row} />
      <script type="application/ld+json">
        {jsonLdString(eventJsonLd(row))}
      </script>
    </>
  );
}

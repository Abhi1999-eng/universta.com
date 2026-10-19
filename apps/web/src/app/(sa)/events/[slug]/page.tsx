import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { EventGuide } from '@/components/study-abroad/RecordGuide';
import { jsonLdString } from '@/lib/json-ld';
import { phaseDetail, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function event(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('events', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await event(slug);
  if (!row) return { title: { absolute: 'Event not found | Universta' }, robots: { index: false } };
  const metadata = phaseOneMetadata(row, `/events/${row.slug ?? slug}`, 'Event', 'event');
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

function eventJsonLd(row: AnyRecord) {
  const isOnline = row.eventType === 'ONLINE';
  const isHybrid = row.eventType === 'HYBRID';
  const venue = row.venue ? { '@type': 'Place', name: row.venue } : undefined;
  const virtual = row.onlineUrl ? { '@type': 'VirtualLocation', url: row.onlineUrl } : undefined;
  const location = isHybrid ? [venue, virtual].filter(Boolean) : isOnline ? virtual : venue;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: row.title,
    description: row.description ?? row.summary ?? row.title,
    startDate: row.startsAt,
    endDate: row.endsAt ?? undefined,
    eventAttendanceMode: isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : isHybrid
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location,
    organizer: { '@type': 'Organization', name: 'Universta' },
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
      <EventGuide row={row as unknown as Record<string, unknown> & { id: string }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(eventJsonLd(row)) }} />
    </>
  );
}

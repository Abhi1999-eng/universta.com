import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { moreEvents } from '@/components/study-abroad/EventCards';
import type { DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { EventGuide } from '@/components/study-abroad/RecordGuide';
import { eventJsonLd } from '@/lib/event-json-ld';
import { jsonLdString } from '@/lib/json-ld';
import { phaseDetail, phaseListAll, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { getDestinations } from '@/lib/study-abroad';
import '../../records-zip.css';

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

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  /* The event, every published one for "More upcoming events", and the
     country guides its place may link to; a failure of either extra only
     leaves its part out. */
  const [row, all, directory] = await Promise.all([
    event(slug),
    phaseListAll<DirectoryRow>('events')
      .then((page) => page.data)
      .catch(() => [] as DirectoryRow[]),
    getDestinations().catch(() => null),
  ]);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/events/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const record = row as unknown as DirectoryRow;
  const guides = new Set((directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])));
  const now = new Date().getTime();
  return (
    <>
      <EventGuide row={record} more={moreEvents(record, all, now, 4)} guides={guides} now={now} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(eventJsonLd(record)) }} />
    </>
  );
}

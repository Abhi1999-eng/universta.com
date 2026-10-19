import type { Metadata } from 'next';
import { EventCard, eventItem, NextEventCard, nextEvent } from '@/components/study-abroad/EventCards';
import { EventDirectory } from '@/components/study-abroad/EventDirectory';
import { RecordDirectory, type DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { phaseListAll } from '@/lib/phase1';
import { splitEvents } from '@/lib/record-dates';
import { staticPageMetadata } from '@/lib/static-page-seo';
import { getDestinations } from '@/lib/study-abroad';
import '../records-zip.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'events-listing',
    'Events',
    'Explore currently published Universta events and info sessions.',
    '/events',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function EventsPage() {
  let rows: DirectoryRow[] = [];
  let total = 0;
  const [loaded, directory] = await Promise.all([
    /* Every published record: these directories are short, and a first page of
       twelve with no way past it hid the rest. */
    phaseListAll<DirectoryRow>('events').catch(() => null),
    getDestinations().catch(() => null),
  ]);
  if (loaded) {
    rows = loaded.data;
    total = rows.length;
  }
  const guides = new Set((directory?.available ?? []).flatMap((entry) => (entry.slug ? [entry.slug] : [])));
  const now = Date.now();
  /* Upcoming first, soonest first, then the ones already held, newest
     first -- decided here, from each event's end, so a running event is
     still upcoming whatever order the API sends. */
  const { upcoming, past } = splitEvents(rows, now);
  const ordered = [...upcoming, ...past];
  const next = nextEvent(rows, now);
  return (
    <RecordDirectory
      trail="Events"
      eyebrow="Events"
      title="Study abroad events"
      lede="Webinars, fairs and info sessions, with the date, format and how to register."
      noun={['event', 'events']}
      total={total}
      rows={ordered}
      card={(row) => <EventCard row={row} key={row.id} guides={guides} now={now} />}
      empty={{ heading: 'No events scheduled yet', body: 'Upcoming webinars and info sessions are listed here when they are announced.' }}
      aside={next ? <NextEventCard row={next} guides={guides} now={now} /> : null}
      body={<EventDirectory items={ordered.map((row) => eventItem(row, guides, now))} serverNow={now} />}
    />
  );
}

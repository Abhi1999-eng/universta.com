import type { Metadata } from 'next';
import { EventCard, RecordDirectory, type DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { phaseListAll } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

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
  try {
    /* Every published record: these directories are short, and a first page of
       twelve with no way past it hid the rest. */
    rows = (await phaseListAll<DirectoryRow>('events')).data;
    total = rows.length;
  } catch {}
  return (
    <RecordDirectory
      trail="Events"
      eyebrow="Events"
      title="Study abroad events"
      lede="Webinars, fairs and info sessions, with the date, format and how to register."
      noun={['event', 'events']}
      total={total}
      rows={rows}
      card={(row) => <EventCard row={row} key={row.id} />}
      empty={{ heading: 'No events scheduled yet', body: 'Upcoming webinars and info sessions are listed here when they are announced.' }}
    />
  );
}

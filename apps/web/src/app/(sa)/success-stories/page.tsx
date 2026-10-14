import type { Metadata } from 'next';
import { RecordDirectory, StoryCard, type DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { phaseListAll } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'success-stories-listing',
    'Success stories',
    'Explore currently published Universta student success stories.',
    '/success-stories',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function StoriesPage() {
  let rows: DirectoryRow[] = [];
  let total = 0;
  try {
    /* Every published record: these directories are short, and a first page of
       twelve with no way past it hid the rest. */
    rows = (await phaseListAll<DirectoryRow>('success-stories')).data;
    total = rows.length;
  } catch {}
  return (
    <RecordDirectory
      trail="Success stories"
      eyebrow="Student journeys"
      title="Success stories"
      lede="Long-form accounts of how students planned and made their move abroad."
      noun={['success story', 'success stories']}
      total={total}
      rows={rows}
      card={(row) => <StoryCard row={row} key={row.id} />}
      empty={{ heading: 'No success stories yet', body: 'Stories will appear here when they are ready to share.' }}
      wide
    />
  );
}

import type { Metadata } from 'next';
import { RecordDirectory, TestimonialCard, type DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { phaseListAll } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';
import '../records-zip.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'testimonials-listing',
    'Testimonials',
    'Explore currently published Universta student testimonials.',
    '/testimonials',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function TestimonialsPage() {
  let rows: DirectoryRow[] = [];
  let total = 0;
  try {
    /* Every published record: these directories are short, and a first page of
       twelve with no way past it hid the rest. */
    rows = (await phaseListAll<DirectoryRow>('testimonials')).data;
    total = rows.length;
  } catch {}
  return (
    <RecordDirectory
      trail="Testimonials"
      eyebrow="In their words"
      title="Testimonials"
      lede="What students said about planning their study abroad with Universta."
      noun={['testimonial', 'testimonials']}
      total={total}
      rows={rows}
      card={(row) => <TestimonialCard row={row} key={row.id} />}
      empty={{ heading: 'No testimonials yet', body: 'Student testimonials will appear here once they are published.' }}
      /* The zip's quote card, in the grid the country guide draws it in. */
      grid="quotes"
    />
  );
}

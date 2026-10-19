import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import type { DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { JobGuide } from '@/components/study-abroad/RecordGuide';
import { jobPostingJsonLd } from '@/lib/job-json-ld';
import { jsonLdString } from '@/lib/json-ld';
import { phaseDetail, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';
import { jobClosed } from '@/lib/record-dates';
import '../../records-zip.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

async function job(slug: string) {
  try {
    return await phaseDetail<AnyRecord>('jobs', slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await job(slug);
  if (!row) return { title: { absolute: 'Career not found | Universta' }, robots: { index: false } };
  const metadata = phaseOneMetadata(row, `/careers/${row.slug ?? slug}`, 'Career', 'job');
  /* The helper writes the site's suffix; the route family's template would add it again. */
  const titled = { ...metadata, title: { absolute: String(metadata.title) } };
  /* A closed role keeps answering, so a shared link explains itself, but
     search engines are asked to drop it. */
  return jobClosed(row.expiryDate) ? { ...titled, robots: { index: false, follow: true } } : titled;
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const row = await job(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/careers/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const record = row as unknown as DirectoryRow;
  const now = new Date().getTime();
  return (
    <>
      <JobGuide row={record} now={now} />
      {/* A closed role is no longer a job posting. */}
      {jobClosed(record.expiryDate, now) ? null : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jobPostingJsonLd(record)) }} />
      )}
    </>
  );
}

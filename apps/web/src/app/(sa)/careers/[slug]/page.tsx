import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { type AnyRecord } from '@/components/phase1/PhaseOneViews';
import { JobGuide } from '@/components/study-abroad/RecordGuide';
import { jsonLdString } from '@/lib/json-ld';
import { phaseDetail, phaseResolveRedirect } from '@/lib/phase1';
import { phaseOneMetadata } from '@/lib/phase1-metadata';

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
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

function jobPostingJsonLd(row: AnyRecord) {
  const datePosted = row.publishedDate ?? row.createdAt;
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: row.title,
    description: row.description ?? row.summary ?? row.title,
    datePosted,
    validThrough: row.expiryDate ?? undefined,
    employmentType: row.employmentType ?? undefined,
    hiringOrganization: { '@type': 'Organization', name: 'Universta' },
    jobLocation: row.location ? { '@type': 'Place', address: row.location } : undefined,
    jobLocationType: row.remoteStatus === 'REMOTE' ? 'TELECOMMUTE' : undefined,
  };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const row = await job(slug);
  if (!row) {
    const redirect = await phaseResolveRedirect(`/careers/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return (
    <>
      <JobGuide row={row as unknown as Record<string, unknown> & { id: string }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jobPostingJsonLd(row)) }} />
    </>
  );
}

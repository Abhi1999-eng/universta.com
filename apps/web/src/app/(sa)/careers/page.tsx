import type { Metadata } from 'next';
import { JobCard, jobSearchText, RecordDirectory, type DirectoryRow } from '@/components/study-abroad/RecordDirectory';
import { RecordSearch } from '@/components/study-abroad/RecordSearch';
import { phaseListAll } from '@/lib/phase1';
import { staticPageMetadata } from '@/lib/static-page-seo';
import '../records-zip.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await staticPageMetadata(
    'careers-listing',
    'Careers',
    'Explore currently published job openings at Universta.',
    '/careers',
  );
  /* The helper writes the site's suffix; the route family's template would add it again. */
  return { ...metadata, title: { absolute: String(metadata.title) } };
}

export default async function CareersPage() {
  let rows: DirectoryRow[] = [];
  let total = 0;
  try {
    /* Every published record: these directories are short, and a first page of
       twelve with no way past it hid the rest. */
    rows = (await phaseListAll<DirectoryRow>('jobs')).data;
    total = rows.length;
  } catch {}
  const now = new Date().getTime();
  return (
    <RecordDirectory
      trail="Careers"
      eyebrow="Careers"
      title="Work with Universta"
      lede="Open roles on the team that builds and runs Universta."
      noun={['open role', 'open roles']}
      total={total}
      rows={rows}
      card={(row) => <JobCard row={row} key={row.id} now={now} />}
      empty={{ heading: 'No open roles right now', body: 'New roles are listed here as soon as they open.' }}
      /* The zip's directory: one search box over the roles already loaded,
         and the roles grouped under their team, with no counts. */
      body={
        <RecordSearch
          look="directory"
          label="Search roles"
          placeholder="Search roles by title, team or place"
          none="No role matches that search. Try a shorter word, or clear the box."
          ungrouped="Other roles"
          items={rows.map((row) => ({
            key: row.id,
            text: jobSearchText(row),
            group: typeof row.department === 'string' ? row.department : null,
            node: <JobCard row={row} now={now} />,
          }))}
        />
      }
    />
  );
}

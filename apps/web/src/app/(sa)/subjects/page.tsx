import type { Metadata } from 'next';
import { getSubjects } from '@/lib/catalog';
import {
  SubjectIndex,
  type SubjectIndexRow,
} from '@/components/study-abroad/SubjectIndex';
import { PlanBand } from '@/components/study-abroad/PlanBand';
import {
  ConnectBand,
  MatchBand,
} from '@/components/study-abroad/DiscoveryBands';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Subjects and specializations',
  description:
    'Explore subjects and specializations, then discover study pathways available in your destination.',
  alternates: { canonical: '/subjects' },
};

export default async function SubjectsIndexPage() {
  /* The explorer searches specializations as well as subjects, so each row
     arrives with its branches rather than a count to look up later. */
  const subjects = await getSubjects({ limit: '100' })
    .then((result) => result.data as SubjectIndexRow[])
    .catch(() => []);

  return (
    <>
      <SubjectIndex subjects={subjects} />

      <MatchBand heading="Found your field?" href="/courses" />

      <PlanBand
        heading="Not sure which field is right for you?"
        body="Tell us about your academic profile, goals and budget. We'll help you understand your options across every subject we cover."
        secondary={{ href: '/specializations', label: 'Browse specializations' }}
      />

      <ConnectBand
        actions={[
          { href: '/courses', label: 'Explore courses' },
          { href: '/specializations', label: 'All specializations', ghost: true },
          { href: '/study-abroad', label: 'Compare destinations', ghost: true },
        ]}
        groups={[
          {
            title: 'Subjects',
            items: subjects.slice(0, 6).map((row) => ({
              id: row.id,
              name: row.name,
              href: `/subjects/${row.slug}`,
            })),
          },
        ]}
      />
    </>
  );
}

import type { Metadata } from 'next';
import { LeadConsultantAssignmentCard } from '@/features/leads/LeadConsultantAssignmentCard';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';

export const metadata: Metadata = {
  title: 'Lead details | Universta Admin',
  robots: { index: false, follow: false },
};

export default async function LeadDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const leadId = (await params).id;
  return (
    <>
      <LeadConsultantAssignmentCard leadId={leadId} />
      <LeadDetailPage leadId={leadId} />
    </>
  );
}

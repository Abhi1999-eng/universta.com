import type { Metadata } from 'next';
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
  return <LeadDetailPage leadId={(await params).id} />;
}

import type { Metadata } from 'next';
import { LeadsPage } from '@/features/leads/LeadsPage';

export const metadata: Metadata = {
  title: 'Leads | Universta Admin',
  robots: { index: false, follow: false },
};

export default function LeadsRoute() {
  return <LeadsPage />;
}

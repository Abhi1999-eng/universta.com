import { redirect } from 'next/navigation';

export default async function ReferralLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/student/register?ref=${encodeURIComponent(code)}`);
}

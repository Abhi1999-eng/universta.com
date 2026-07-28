'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';

const quickLinks = [
  { icon: 'C', label: 'Countries', href: '/countries' },
  { icon: 'S', label: 'Subjects', href: '/subjects' },
  { icon: 'C', label: 'Courses', href: '/courses' },
  { icon: 'L', label: 'Leads', href: '/leads' },
  { icon: 'P1', label: 'Phase 1 content', href: '/phase1/universities' },
  { icon: 'M', label: 'Catalog masters', href: '/catalog-masters' },
];

export function DashboardContent() {
  const { user } = useAuth();
  const firstName = user?.firstName || 'there';

  return (
    <section aria-labelledby="dashboard-heading" className="mx-auto max-w-[1180px]">
      <div className="rounded-[28px] bg-[#1657CF] px-6 py-8 text-white shadow-[0_18px_50px_rgba(22,87,207,0.18)] sm:px-10 sm:py-10">
        <p className="text-sm font-semibold text-white/70">Super Admin workspace</p>
        <h2 id="dashboard-heading" className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          Good to see you, {firstName}.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
          Countries, Subjects, Courses, Leads and the expanded Phase 1 catalog are live. Jump in below.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[24px] border border-[#E8ECF3] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Workspace status</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">Admin workspace ready</h3>
            </div>
            <span className="rounded-full bg-[#E9F8F0] px-3 py-1 text-xs font-bold text-[#18794E]">Active</span>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#48505F]">
            Authentication is active and your account has access to the full published catalog workspace.
          </p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <InfoItem label="Account email" value={user?.email ?? 'Unavailable'} />
            <InfoItem label="Active role" value={user?.roles.join(', ') ?? 'Unavailable'} />
          </div>
        </article>

        <article className="rounded-[24px] border border-[#E8ECF3] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Quick links</p>
          <div className="mt-5 grid gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#48505F] transition hover:bg-[#F0F4FA] hover:text-[#0D1524]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EEF4FF] text-xs font-bold text-[#1657CF]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FAFBFD] p-4">
      <p className="text-xs font-semibold text-[#828B9B]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#0D1524]">{value}</p>
    </div>
  );
}

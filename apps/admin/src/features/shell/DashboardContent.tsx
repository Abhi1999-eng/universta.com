'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { NAV_GROUPS } from './nav-config';

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
          Everything you manage lives in the sidebar, grouped by area. The quick links below jump straight to the
          resources you use most.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoItem label="Account email" value={user?.email ?? 'Unavailable'} />
        <InfoItem label="Active role" value={user?.roles.join(', ') ?? 'Unavailable'} />
      </div>

      <div className="mt-10 space-y-8">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">{group.label}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Link
                  key={`${group.label}-${item.label}`}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-[#E8ECF3] bg-white p-4 text-sm font-semibold text-[#0D1524] transition hover:border-[#1657CF] hover:shadow-[0_8px_20px_rgba(22,87,207,0.08)]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-sm font-bold text-[#1657CF]">
                    {item.label.slice(0, 1)}
                  </span>
                  <span>
                    {item.label}
                    {item.note ? <span className="mt-0.5 block text-xs font-normal text-[#9AA3B2]">{item.note}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E8ECF3] bg-white p-4">
      <p className="text-xs font-semibold text-[#828B9B]">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-[#0D1524]">{value}</p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { NAV_GROUPS } from './nav-config';

export function DashboardContent() {
  const { user } = useAuth();
  const firstName = user?.firstName || 'there';

  return (
    <section aria-labelledby="dashboard-heading" className="p-dash">
      <div className="p-panel p-panel--dark">
        <p className="p-eyebrow">Super Admin workspace</p>
        <h2 id="dashboard-heading" className="p-h1">
          Good to see you, {firstName}.
        </h2>
        <p className="p-sub">
          Everything you manage lives in the sidebar, grouped by area. The quick links below jump straight to the
          resources you use most.
        </p>
      </div>

      <div className="p-grid2" style={{ marginTop: 18 }}>
        <InfoItem label="Account email" value={user?.email ?? 'Unavailable'} />
        <InfoItem label="Active role" value={user?.roles.join(', ') ?? 'Unavailable'} />
      </div>

      <div className="mt-10 space-y-8">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <h3 className="p-eyebrow">{group.label}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <Link
                  key={`${group.label}-${item.label}`}
                  href={item.href}
                  className="p-card p-row"
                >
                  <span className="p-avatar">
                    {item.label.slice(0, 1)}
                  </span>
                  <span>
                    {item.label}
                    {item.hints?.length ? <span className="p-hint">Also manages {item.hints.join(' and ')}</span> : null}
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
    <div className="p-panel">
      <p className="p-label">{label}</p>
      {/* A plain value: `p-big` is display-sized, which an email is not. */}
      <p style={{ wordBreak: 'break-word' }}>{value}</p>
    </div>
  );
}

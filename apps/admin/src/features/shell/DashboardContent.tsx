'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rolesLabel } from './role-label';
import { useAuth } from '@/features/auth/AuthProvider';
import { authFetch } from '@/features/auth/auth-client';
import {
  listAdminCourses,
  listCountries,
  listSpecializations,
  listSubjects,
} from '@/features/catalog/catalog-client';
import { listLeads } from '@/features/leads/leads-client';
import { formatUpdated, StatusBadge } from '@/features/shared/records-ui';

type Count = { published: number | null; draft: number | null };
type Recent = { id: string; name: string; kind: string; href: string; status: string; updatedAt: string };

/* The catalogue, by what an editor manages, with where each lives. */
const AREAS: Array<{ key: string; label: string; one: string; href: string }> = [
  { key: 'countries', label: 'Countries', one: 'Country', href: '/countries' },
  { key: 'subjects', label: 'Subjects', one: 'Subject', href: '/subjects' },
  { key: 'specializations', label: 'Specializations', one: 'Specialization', href: '/specializations' },
  { key: 'courses', label: 'Courses', one: 'Course', href: '/courses' },
  { key: 'universities', label: 'Universities', one: 'University', href: '/phase1/universities' },
  { key: 'scholarships', label: 'Scholarships', one: 'Scholarship', href: '/phase1/scholarships' },
  { key: 'consultants', label: 'Consultants', one: 'Consultant', href: '/phase1/consultants' },
];

async function phase1Total(resource: string, status: string): Promise<number | null> {
  const response = await authFetch(`/api/v1/admin/phase1/${resource}?status=${status}&limit=1`);
  if (!response.ok) return null;
  const body = (await response.json()) as { meta?: { total?: number } | null };
  return body.meta?.total ?? null;
}

async function phase1Recent(resource: string, kind: string, limit: number): Promise<Recent[]> {
  const response = await authFetch(`/api/v1/admin/phase1/${resource}?limit=${limit}`);
  if (!response.ok) return [];
  const body = (await response.json()) as { data?: Array<{ id: string; name?: string; title?: string; status?: string; updatedAt?: string }> };
  return (body.data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? row.title ?? 'Untitled',
    kind,
    href: `/phase1/${resource}?edit=${row.id}`,
    status: row.status ?? '',
    updatedAt: row.updatedAt ?? '',
  }));
}

/** A total by status for one area; null when that list could not be read. */
async function countFor(key: string, status: 'PUBLISHED' | 'DRAFT'): Promise<number | null> {
  const total = (result: { meta: { total?: number } | null }) => result.meta?.total ?? null;
  switch (key) {
    case 'countries':
      return total(await listCountries({ status, limit: 1 }));
    case 'subjects':
      return total(await listSubjects({ status, limit: 1 }));
    case 'specializations':
      return total(await listSpecializations({ status, limit: 1 }));
    case 'courses':
      return total(await listAdminCourses({ status, limit: 1 }));
    default:
      return phase1Total(key, status);
  }
}

const settle = async <T,>(work: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await work;
  } catch {
    return fallback;
  }
};

/**
 * The dashboard says what needs doing and what changed, rather than
 * repeating the sidebar: drafts waiting to go live and new enquiries first,
 * then how much of each area is live, then the latest edits across the
 * catalogue. Every number links to the list it counts.
 */
export function DashboardContent() {
  const { user } = useAuth();
  const firstName = user?.firstName || 'there';
  const [counts, setCounts] = useState<Record<string, Count> | null>(null);
  const [newLeads, setNewLeads] = useState<number | null>(null);
  const [recent, setRecent] = useState<Recent[] | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all(
      AREAS.map(async (area) => {
        const [published, draft] = await Promise.all([
          settle(countFor(area.key, 'PUBLISHED'), null),
          settle(countFor(area.key, 'DRAFT'), null),
        ]);
        return [area.key, { published, draft }] as const;
      }),
    ).then((rows) => {
      if (active) setCounts(Object.fromEntries(rows));
    });
    void settle(listLeads({ status: 'NEW', limit: 1 }).then((result) => result.meta.total ?? null), null).then((value) => {
      if (active) setNewLeads(value);
    });
    void Promise.all([
      settle(listSubjects({ sort: 'updatedAt', limit: 5 }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, kind: 'Subject', href: `/subjects/${row.id}`, status: row.status, updatedAt: row.updatedAt }))), [] as Recent[]),
      settle(listSpecializations({ sort: 'updatedAt', limit: 5 }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, kind: 'Specialization', href: `/specializations/${row.id}`, status: row.status, updatedAt: row.updatedAt }))), [] as Recent[]),
      settle(listAdminCourses({ sort: 'newest', limit: 5 }).then((r) => r.data.map((row) => ({ id: row.id, name: row.name, kind: 'Course', href: `/courses/${row.id}`, status: row.status, updatedAt: row.updatedAt }))), [] as Recent[]),
      settle(phase1Recent('universities', 'University', 5), [] as Recent[]),
      settle(phase1Recent('scholarships', 'Scholarship', 5), [] as Recent[]),
    ]).then((groups) => {
      if (!active) return;
      setRecent(
        groups
          .flat()
          .filter((row) => row.updatedAt)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 8),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const drafts = AREAS.map((area) => ({ ...area, draft: counts?.[area.key]?.draft ?? null })).filter((area) => (area.draft ?? 0) > 0);

  return (
    <section aria-labelledby="dashboard-heading" className="p-dash">
      <div className="p-dash__main">
        <div className="p-panel p-panel--dark">
          <p className="p-eyebrow">Super Admin workspace</p>
          <h2 id="dashboard-heading" className="p-h2">
            Good to see you, {firstName}.
          </h2>
          <p className="p-sub">What is waiting for you, how much of the catalogue is live, and what changed last.</p>
        </div>

        <section className="p-panel" aria-labelledby="dash-attention">
          <h3 id="dash-attention" className="p-h3">Needs attention</h3>
          {counts === null || newLeads === null ? (
            <p className="p-sub">Checking…</p>
          ) : drafts.length === 0 && !newLeads ? (
            <p className="p-sub">Nothing waiting. Every record is published and there are no new enquiries.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#E8ECF3]">
              {newLeads ? (
                <li className="flex items-center justify-between gap-3 py-2">
                  <span><strong>{newLeads}</strong> new counselling {newLeads === 1 ? 'lead' : 'leads'} not yet contacted</span>
                  <Link href="/leads?status=NEW" className="p-link">Open leads</Link>
                </li>
              ) : null}
              {drafts.map((area) => (
                <li key={area.key} className="flex items-center justify-between gap-3 py-2">
                  <span><strong>{area.draft}</strong> {(area.draft === 1 ? area.one : area.label).toLowerCase()} in draft, not on the website</span>
                  <Link href={`${area.href}?status=DRAFT`} className="p-link">Review drafts</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-panel" aria-labelledby="dash-recent">
          <h3 id="dash-recent" className="p-h3">Recently changed</h3>
          {recent === null ? (
            <p className="p-sub">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="p-sub">Nothing has been edited yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#E8ECF3]">
              {recent.map((row) => (
                <li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span>
                    <Link href={row.href} className="p-link font-semibold">{row.name}</Link>{' '}
                    <span className="p-hint">{row.kind}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={row.status} />
                    <span className="p-hint">{formatUpdated(row.updatedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="p-dash__side">
        <InfoItem label="Account email" value={user?.email ?? 'Unavailable'} />
        <InfoItem label="Active role" value={user?.roles?.length ? rolesLabel(user.roles) : 'Unavailable'} />

        <section className="p-panel" aria-labelledby="dash-glance">
          <h3 id="dash-glance" className="p-h3">The catalogue at a glance</h3>
          <p className="p-hint">Live on the website, of all records.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {AREAS.map((area) => {
              const count = counts?.[area.key];
              const published = count?.published;
              const total = published != null && count?.draft != null ? published + count.draft : null;
              return (
                <Link key={area.key} href={area.href} className="p-card block">
                  <span className="p-label">{area.label}</span>
                  <span className="block text-2xl font-semibold text-[#071426]">{published ?? '—'}</span>
                  <span className="p-hint">{total == null ? 'live' : `of ${total}`}</span>
                </Link>
              );
            })}
          </div>
        </section>
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

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLeadOptions, listLeads } from './leads-client';
import type {
  LeadListParams,
  LeadOptions,
  LeadRecord,
  PageMeta,
} from './leads.types';

type Filters = {
  q: string;
  status: string;
  countryId: string;
  courseLevelId: string;
  intakeId: string;
  sourceType: string;
  createdFrom: string;
  createdTo: string;
};

const EMPTY_FILTERS: Filters = {
  q: '',
  status: '',
  countryId: '',
  courseLevelId: '',
  intakeId: '',
  sourceType: '',
  createdFrom: '',
  createdTo: '',
};

function filtersFrom(search: URLSearchParams): Filters {
  return {
    q: search.get('q') ?? '',
    status: search.get('status') ?? '',
    countryId: search.get('countryId') ?? '',
    courseLevelId: search.get('courseLevelId') ?? '',
    intakeId: search.get('intakeId') ?? '',
    sourceType: search.get('sourceType') ?? '',
    createdFrom: search.get('createdFrom') ?? '',
    createdTo: search.get('createdTo') ?? '',
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function displayName(lead: LeadRecord): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ');
}

function maskEmail(value: string | null): string {
  if (!value) return 'No email';
  const [local, domain] = value.split('@');
  if (!domain) return 'Email available';
  return `${local.slice(0, 2)}•••@${domain}`;
}

function maskPhone(value: string): string {
  const visible = value.slice(-4);
  return `${'•'.repeat(Math.max(0, Math.min(8, value.length - 4)))}${visible}`;
}

function statusLabel(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = searchParams.toString();
  const activeFilters = useMemo(
    () => filtersFrom(new URLSearchParams(location)),
    [location],
  );
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const [draft, setDraft] = useState(activeFilters);
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [options, setOptions] = useState<LeadOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(activeFilters), 0);
    return () => window.clearTimeout(timer);
  }, [activeFilters]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const params: LeadListParams = {
          ...activeFilters,
          page,
          limit: 20,
        };
        const [result, loadedOptions] = await Promise.all([
          listLeads(params, signal),
          options ? Promise.resolve(options) : getLeadOptions(signal),
        ]);
        setRows(result.data);
        setMeta(result.meta);
        setOptions(loadedOptions);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(
          cause instanceof Error ? cause.message : 'Unable to load leads.',
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [activeFilters, options, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  function hrefFor(filters: Filters, nextPage?: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (nextPage && nextPage > 1) params.set('page', String(nextPage));
    return `${pathname}${params.size ? `?${params}` : ''}`;
  }

  function navigate(filters: Filters, nextPage?: number) {
    router.push(hrefFor(filters, nextPage), {
      scroll: false,
    });
  }

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <section aria-labelledby="leads-heading" className="mx-auto max-w-[1240px]">
      <div className="p-head">
        <div>
          <p className="p-eyebrow">
            Counselling pipeline
          </p>
          <h2
            id="leads-heading"
            className="p-h1"
          >
            Leads
          </h2>
          <p className="p-sub">
            Review counselling requests, update progress and keep internal
            follow-up notes.
          </p>
        </div>
        <p className="text-sm font-semibold text-[#48505F]" role="status">
          {meta ? `${meta.total} ${meta.total === 1 ? 'lead' : 'leads'}` : '—'}
        </p>
      </div>

      <form
        aria-label="Lead filters"
        className="mt-8 rounded-2xl border border-[#E8ECF3] bg-white p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(draft);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Search" className="sm:col-span-2">
            <input
              type="search"
              value={draft.q}
              onChange={(event) => set('q', event.target.value)}
              placeholder="Name, email or phone"
              className="lead-control"
            />
          </Filter>
          <Filter label="Status">
            <select
              value={draft.status}
              onChange={(event) => set('status', event.target.value)}
              className="lead-control"
            >
              <option value="">All statuses</option>
              {options?.statuses.map((status) => (
                <option value={status} key={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Source">
            <select
              value={draft.sourceType}
              onChange={(event) => set('sourceType', event.target.value)}
              className="lead-control"
            >
              <option value="">All sources</option>
              {options?.sourceTypes.map((source) => (
                <option value={source} key={source}>
                  {statusLabel(source)}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Interested country">
            <select
              value={draft.countryId}
              onChange={(event) => set('countryId', event.target.value)}
              className="lead-control"
            >
              <option value="">All countries</option>
              {options?.countries.map((country) => (
                <option value={country.id} key={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Study level">
            <select
              value={draft.courseLevelId}
              onChange={(event) => set('courseLevelId', event.target.value)}
              className="lead-control"
            >
              <option value="">All levels</option>
              {options?.courseLevels.map((level) => (
                <option value={level.id} key={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Intake">
            <select
              value={draft.intakeId}
              onChange={(event) => set('intakeId', event.target.value)}
              className="lead-control"
            >
              <option value="">All intakes</option>
              {options?.intakes.map((intake) => (
                <option value={intake.id} key={intake.id}>
                  {intake.shortLabel ?? intake.name}
                </option>
              ))}
            </select>
          </Filter>
          <div className="grid grid-cols-2 gap-3">
            <Filter label="From date">
              <input
                type="date"
                value={draft.createdFrom}
                onChange={(event) => set('createdFrom', event.target.value)}
                className="lead-control"
              />
            </Filter>
            <Filter label="To date">
              <input
                type="date"
                value={draft.createdTo}
                onChange={(event) => set('createdTo', event.target.value)}
                className="lead-control"
              />
            </Filter>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            className="p-btn p-btn--primary"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              navigate(EMPTY_FILTERS);
            }}
            className="rounded-xl border border-[#D9E0EA] bg-white px-5 py-3 text-sm font-semibold text-[#48505F] hover:border-[#1657CF] hover:text-[#1657CF] focus:outline-none focus:ring-2 focus:ring-[#DCE8FF]"
          >
            Clear filters
          </button>
        </div>
      </form>

      {/* Single settle point for the four mutually exclusive result states.
          `data-state` lets tests await a settled outcome deterministically
          instead of sampling a negative ("no error yet") that is trivially
          true while still loading. */}
      <div
        data-testid="leads-results"
        data-state={
          loading ? 'loading' : error ? 'error' : rows.length ? 'ready' : 'empty'
        }
      >
      {loading ? (
        <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-10 text-center text-sm text-[#667085]" role="status">
          Loading leads…
        </div>
      ) : null}
      {!loading && error ? (
        <div data-testid="leads-error" className="mt-6 rounded-2xl border border-[#F3C7C7] bg-[#FFF7F7] p-6" role="alert">
          <h3 className="font-semibold text-[#9F1D1D]">Leads could not be loaded</h3>
          <p className="mt-2 text-sm text-[#7A3232]">{error}</p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            className="mt-4 rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <>
          <div data-testid="leads-empty-state" className="mt-6 rounded-2xl border border-dashed border-[#CBD5E4] bg-white p-10 text-center">
            <h3 className="p-h3">No leads found</h3>
            <p className="p-sub">
              New counselling requests or leads matching these filters will
              appear here.
            </p>
          </div>
          {meta && meta.page > 1 ? (
            <nav aria-label="Lead result pages" className="p-panel p-row p-row--between">
              <a href={hrefFor(activeFilters, meta.page - 1)} className="p-btn p-btn--ghost p-btn--sm">
                Previous
              </a>
              <span className="p-sub">Page {meta.page} of {Math.max(1, meta.totalPages)}</span>
              <button type="button" disabled className="p-btn p-btn--ghost p-btn--sm">
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
      {!loading && !error && rows.length ? (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-[#E8ECF3] bg-white md:block">
            <table className="p-table u-table min-w-[980px]">
              <thead>
                <tr>
                  {['Name', 'Contact', 'Interest', 'Source', 'Status', 'Created', ''].map((heading) => (
                    <th className="px-5 py-4 font-semibold" key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr className="border-t border-[#EEF1F5]" key={lead.id}>
                    <td>
                      <p >{displayName(lead)}</p>
                      <p className="p-hint">{lead.leadNumber}</p>
                    </td>
                    <td >
                      <p>{maskEmail(lead.email)}</p>
                      <p className="mt-1 text-xs">{maskPhone(lead.phoneNumber)}</p>
                    </td>
                    <td >
                      <p>{lead.preferredCountry?.name ?? '—'}</p>
                      <p className="mt-1 text-xs">{lead.preferredCourseLevel?.name ?? '—'} · {lead.preferredIntake?.shortLabel ?? lead.preferredIntake?.name ?? '—'}</p>
                    </td>
                    <td >{statusLabel(lead.sourceType ?? 'GENERAL')}</td>
                    <td><StatusPill status={lead.status} /></td>
                    <td >{formatDate(lead.createdAt)}</td>
                    <td>
                      <Link href={`/leads/${lead.id}`} className="inline-block whitespace-nowrap font-semibold text-[#1657CF] hover:underline">
                        View lead
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-4 md:hidden">
            {rows.map((lead) => (
              <article className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#E8ECF3] bg-white p-5 shadow-sm" key={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{displayName(lead)}</h3>
                    <p className="p-hint">{lead.leadNumber}</p>
                  </div>
                  <StatusPill status={lead.status} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <MobileFact label="Contact" value={`${maskEmail(lead.email)} · ${maskPhone(lead.phoneNumber)}`} />
                  <MobileFact label="Interest" value={[lead.preferredCountry?.name, lead.preferredCourseLevel?.name, lead.preferredIntake?.shortLabel ?? lead.preferredIntake?.name].filter(Boolean).join(' · ') || '—'} />
                  <MobileFact label="Source" value={statusLabel(lead.sourceType ?? 'GENERAL')} />
                  <MobileFact label="Created" value={formatDate(lead.createdAt)} />
                </dl>
                <Link href={`/leads/${lead.id}`} className="mt-5 inline-flex w-full justify-center rounded-xl bg-[#1657CF] px-4 py-3 text-sm font-semibold text-white">
                  View lead
                </Link>
              </article>
            ))}
          </div>
          {meta && (meta.totalPages > 1 || meta.page > 1) ? (
            <nav aria-label="Lead result pages" className="p-panel p-row p-row--between">
              {meta.page <= 1 ? (
                <button type="button" disabled className="p-btn p-btn--ghost p-btn--sm">
                  Previous
                </button>
              ) : (
                <a href={hrefFor(activeFilters, meta.page - 1)} className="p-btn p-btn--ghost p-btn--sm">
                  Previous
                </a>
              )}
              <span className="p-sub">Page {meta.page} of {meta.totalPages}</span>
              {meta.page >= meta.totalPages ? (
                <button type="button" disabled className="p-btn p-btn--ghost p-btn--sm">
                  Next
                </button>
              ) : (
                <a href={hrefFor(activeFilters, meta.page + 1)} className="p-btn p-btn--ghost p-btn--sm">
                  Next
                </a>
              )}
            </nav>
          ) : null}
        </>
      ) : null}
      </div>
    </section>
  );
}

function Filter({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-[#48505F] ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: 'bg-[#E8F0FF] text-[#1657CF]',
    CONTACTED: 'bg-[#FFF4D8] text-[#9A6500]',
    QUALIFIED: 'bg-[#E9F8F0] text-[#18794E]',
    CLOSED: 'bg-[#EEF1F5] text-[#596273]',
  };
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${colors[status] ?? colors.CLOSED}`}>
      {statusLabel(status)}
    </span>
  );
}

function MobileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-[#828B9B]">{label}</dt>
      <dd className="mt-1 break-words [overflow-wrap:anywhere] text-[#48505F]">{value}</dd>
    </div>
  );
}

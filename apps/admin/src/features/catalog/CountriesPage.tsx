'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { deleteCountry, listContinents, listCountries, listCountryTags, listAllSubjects, publishCountry, unpublishCountry } from './catalog-client';
import type { CatalogMutationError, ContinentRecord, CountryRecord, CountryTagRecord, PageMeta, SubjectRecord } from './catalog.types';

type PendingAction = { kind: 'publish' | 'unpublish' | 'delete'; country: CountryRecord } | null;

export function CountriesPage() {
  const [rows, setRows] = useState<CountryRecord[]>([]);
  const [continents, setContinents] = useState<ContinentRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [q, setQ] = useState('');
  const [continentId, setContinentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [tagId, setTagId] = useState('');
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [tags, setTags] = useState<CountryTagRecord[]>([]);
  const [status, setStatus] = useState('');
  const [featured, setFeatured] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState<PendingAction>(null);
  const [pendingValue, setPendingValue] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError('');
    return listCountries({ q, continentId, subjectId, tagId, status, featured: featured === '' ? undefined : featured === 'true', page, limit: 12 }, signal).then((result) => { setRows(result.data); setMeta(result.meta); setLoading(false); }).catch((cause: unknown) => { if (cause instanceof DOMException && cause.name === 'AbortError') return; setLoading(false); setError(cause instanceof Error ? cause.message : 'Unable to load countries'); });
  }, [continentId, featured, page, q, status, subjectId, tagId]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 250); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load, reload]);
  useEffect(() => { void listContinents({ limit: 100 }).then((result) => setContinents(result.data)).catch(() => undefined); }, []);
  useEffect(() => { void listAllSubjects().then(setSubjects).catch(() => undefined); void listCountryTags().then((result) => setTags(result.data)).catch(() => undefined); }, []);

  async function performAction() {
    if (!pending || (pending.kind === 'delete' && pendingValue !== pending.country.name)) return;
    setWorking(true); setError('');
    try {
      if (pending.kind === 'publish') await publishCountry(pending.country.id, pending.country.updatedAt);
      if (pending.kind === 'unpublish') await unpublishCountry(pending.country.id, pending.country.updatedAt);
      if (pending.kind === 'delete') await deleteCountry(pending.country.id, pending.country.updatedAt);
      setSuccess(pending.kind === 'publish' ? 'Country published.' : pending.kind === 'unpublish' ? 'Country unpublished.' : 'Country soft-deleted.');
      setPending(null); setPendingValue(''); setReload((value) => value + 1);
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Catalog action failed');
      setPending(null); setPendingValue('');
    } finally { setWorking(false); }
  }

  function resetFilters() { setQ(''); setContinentId(''); setSubjectId(''); setTagId(''); setStatus(''); setFeatured(''); setPage(1); }

  return (
    <section aria-labelledby="countries-heading" className="mx-auto max-w-[1180px]">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Catalog core</p><h2 id="countries-heading" className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Countries</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">Manage core country records and their public publishing state. Detailed profiles remain deferred.</p></div><Link href="/countries/new" className="rounded-xl bg-[#1657CF] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#0F3FA0] focus:outline-none focus:ring-2 focus:ring-[#1657CF]">Create country</Link></div>
      {success ? <p role="status" className="mt-5 rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]">{success}</p> : null}
      <div className="mt-8 grid gap-3 rounded-2xl border border-[#E8ECF3] bg-white p-4 sm:grid-cols-2 lg:grid-cols-3"><label className="sm:col-span-2 lg:col-span-1"><span className="sr-only">Search countries</span><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Search countries or ISO code" className="w-full rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]" /></label><label><span className="sr-only">Filter by continent</span><select value={continentId} onChange={(event) => { setContinentId(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 text-sm outline-none focus:border-[#1657CF]"><option value="">All continents</option>{continents.map((continent) => <option key={continent.id} value={continent.id}>{continent.name}</option>)}</select></label><label><span className="sr-only">Filter by subject</span><select aria-label="Filter by subject" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 text-sm outline-none focus:border-[#1657CF]"><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span className="sr-only">Filter by tag</span><select aria-label="Filter by tag" value={tagId} onChange={(event) => { setTagId(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 text-sm outline-none focus:border-[#1657CF]"><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 text-sm outline-none focus:border-[#1657CF]"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label><label><span className="sr-only">Filter featured countries</span><select value={featured} onChange={(event) => { setFeatured(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-3 text-sm outline-none focus:border-[#1657CF]"><option value="">Featured: all</option><option value="true">Featured only</option><option value="false">Not featured</option></select></label><button type="button" onClick={resetFilters} className="text-left text-sm font-semibold text-[#1657CF] focus:outline-none focus:underline">Clear filters</button></div>
      <div className="mt-5">{loading ? <CatalogLoading label="Loading countries…" /> : error ? <CatalogError message={error} onRetry={() => { setError(''); setReload((value) => value + 1); }} /> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-[#C9D3E2] bg-white p-12 text-center"><h3 className="text-lg font-semibold">No countries found</h3><p className="mt-2 text-sm text-[#667085]">Create a core country record or adjust the filters.</p></div> : <div className="overflow-hidden rounded-2xl border border-[#E8ECF3] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-[#FAFBFD] text-xs uppercase tracking-[0.12em] text-[#828B9B]"><tr><th className="px-5 py-4">Country</th><th className="px-5 py-4">ISO</th><th className="px-5 py-4">Continent</th><th className="px-5 py-4">Subjects</th><th className="px-5 py-4">Tags</th><th className="px-5 py-4">Linked records</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Featured</th><th className="px-5 py-4">Order</th><th className="px-5 py-4">Updated</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#EEF1F5]">{rows.map((row) => <tr key={row.id}><td className="px-5 py-4"><p className="font-semibold text-[#0D1524]">{row.name}</p><p className="mt-1 text-xs text-[#828B9B]">/{row.slug}</p></td><td className="px-5 py-4 text-[#667085]">{row.iso2Code ?? '—'}{row.iso3Code ? ` / ${row.iso3Code}` : ''}</td><td className="px-5 py-4 text-[#667085]">{row.continent.name}</td><td className="px-5 py-4"><TermList terms={row.subjects} empty="No subjects" /></td><td className="px-5 py-4"><TermList terms={row.tags} empty="No tags" /></td><td className="px-5 py-4 text-xs text-[#667085]">{linkedSummary(row)}</td><td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.status === 'PUBLISHED' ? 'bg-[#E9F8F0] text-[#18794E]' : 'bg-[#FFF4E8] text-[#A15C00]'}`}>{row.status}</span></td><td className="px-5 py-4 text-[#667085]">{row.featured ? 'Yes' : 'No'}</td><td className="px-5 py-4 text-[#667085]">{row.displayOrder}</td><td className="px-5 py-4 text-xs text-[#667085]">{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}</td><td className="px-5 py-4 text-right"><Link href={`/countries/${row.id}`} className="mr-3 font-semibold text-[#1657CF] focus:outline-none focus:underline">Edit</Link>{row.status === 'PUBLISHED' ? <button type="button" onClick={() => setPending({ kind: 'unpublish', country: row })} className="mr-3 font-semibold text-[#A15C00] focus:outline-none focus:underline">Unpublish</button> : <button type="button" onClick={() => setPending({ kind: 'publish', country: row })} className="mr-3 font-semibold text-[#18794E] focus:outline-none focus:underline">Publish</button>}<button type="button" onClick={() => setPending({ kind: 'delete', country: row })} className="font-semibold text-[#B42318] focus:outline-none focus:underline">Delete</button></td></tr>)}</tbody></table></div></div>}</div>
      {meta && meta.totalPages > 1 ? <div className="mt-5 flex items-center justify-between text-sm"><span className="text-[#667085]">Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 disabled:opacity-40">Next</button></div></div> : null}
      {pending ? <CatalogDialog title={pending.kind === 'publish' ? 'Publish country?' : pending.kind === 'unpublish' ? 'Unpublish country?' : 'Delete country?'} description={pending.kind === 'publish' ? 'Publishing makes the core country record available to public country APIs.' : pending.kind === 'unpublish' ? 'Unpublishing removes this country from public APIs while preserving its content.' : 'This is a soft delete and removes the country from normal admin and public lists.'} onClose={() => { if (!working) { setPending(null); setPendingValue(''); } }}><p className="text-sm text-[#48505F]">{pending.kind === 'delete' ? <>Type <strong>{pending.country.name}</strong> to confirm this destructive action.</> : <>Confirm this action for <strong>{pending.country.name}</strong>.</>}</p>{pending.kind === 'delete' ? <input autoFocus value={pendingValue} onChange={(event) => setPendingValue(event.target.value)} placeholder={pending.country.name} className="mt-4 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm outline-none focus:border-[#1657CF]" /> : null}<div className="mt-5 flex justify-end gap-3"><button type="button" disabled={working} onClick={() => { setPending(null); setPendingValue(''); }} className="rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">Cancel</button><button type="button" disabled={working || (pending.kind === 'delete' && pendingValue !== pending.country.name)} onClick={() => void performAction()} className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 ${pending.kind === 'delete' ? 'bg-[#B42318]' : 'bg-[#1657CF]'}`}>{working ? 'Working…' : pending.kind === 'delete' ? 'Delete country' : pending.kind === 'publish' ? 'Publish country' : 'Unpublish country'}</button></div></CatalogDialog> : null}
    </section>
  );
}

/** Assigned taxonomy, kept to a couple of labels so a row stays scannable. */
function TermList({
  terms,
  empty,
  limit = 2,
}: {
  terms?: Array<{ id: string; name: string }>;
  empty: string;
  limit?: number;
}) {
  const rows = terms ?? [];
  if (rows.length === 0)
    return <span className="text-xs text-[#98A2B3]">{empty}</span>;
  const shown = rows.slice(0, limit);
  const remaining = rows.length - shown.length;
  return (
    <span className="text-xs text-[#475467]" title={rows.map((row) => row.name).join(', ')}>
      {shown.map((row) => row.name).join(', ')}
      {remaining > 0 ? ` +${remaining}` : ''}
    </span>
  );
}

/** Counts come from the list payload's `_count`, so the row costs no extra
 * query. */
function linkedSummary(row: CountryRecord): string {
  const counts = row.linkedCounts;
  if (!counts) return '—';
  const plural = (value: number, word: string) =>
    `${value} ${word}${value === 1 ? '' : 's'}`;
  return [
    plural(counts.universities, 'university').replace('universitys', 'universities'),
    plural(counts.courses, 'course'),
    plural(counts.scholarships, 'scholarship'),
  ].join(' · ');
}

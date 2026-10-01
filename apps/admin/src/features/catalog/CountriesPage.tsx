'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { FlashBanner, useHandedOverFlash, type Flash } from '@/features/shared/Flash';
import { deleteCountry, listContinents, listCountries, listCountryTags, listAllSubjects, publishCountry, unpublishCountry } from './catalog-client';
import type { CatalogMutationError, ContinentRecord, CountryRecord, CountryTagRecord, PageMeta, SubjectRecord } from './catalog.types';
import { catalogErrorText } from './catalog-errors';

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
  /* One banner for both sources: a confirmation this page raised itself, and
   * one the country editor handed over when publishing sent the operator
   * here. */
  const [handedOver, dismissHandedOver] = useHandedOverFlash();
  const [ownFlash, setOwnFlash] = useState<Flash | null>(null);
  const flash = ownFlash ?? handedOver;
  const dismissFlash = useCallback(() => {
    setOwnFlash(null);
    dismissHandedOver();
  }, [dismissHandedOver]);
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
      setOwnFlash({ tone: pending.kind === 'publish' ? 'success' : 'neutral', message: pending.kind === 'publish' ? `${pending.country.name} published successfully.` : pending.kind === 'unpublish' ? 'Country unpublished.' : 'Country soft-deleted.' });
      setPending(null); setPendingValue(''); setReload((value) => value + 1);
    } catch (cause: unknown) {
      setError(catalogErrorText(cause, 'Catalog action failed'));
      setPending(null); setPendingValue('');
    } finally { setWorking(false); }
  }

  function resetFilters() { setQ(''); setContinentId(''); setSubjectId(''); setTagId(''); setStatus(''); setFeatured(''); setPage(1); }

  return (
    <section aria-labelledby="countries-heading">
      <header className="p-head"><div><p className="p-eyebrow">Catalog core</p><h2 id="countries-heading" className="p-h1">Countries</h2><p className="p-sub">Manage core country records and their public publishing state. Detailed profiles remain deferred.</p></div><div className="p-head__actions"><Link href="/countries/new" className="p-btn p-btn--primary">Create country</Link></div></header>
      <FlashBanner flash={flash} onDismiss={dismissFlash} />
      <section className="p-panel a-filters p-grid3" aria-label="Filter countries"><label className="sm:col-span-2 lg:col-span-1"><span className="sr-only">Search countries</span><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Search countries or ISO code" className="p-input" /></label><label><span className="sr-only">Filter by continent</span><select value={continentId} onChange={(event) => { setContinentId(event.target.value); setPage(1); }} className="p-input"><option value="">All continents</option>{continents.map((continent) => <option key={continent.id} value={continent.id}>{continent.name}</option>)}</select></label><label><span className="sr-only">Filter by subject</span><select aria-label="Filter by subject" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPage(1); }} className="p-input"><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label><span className="sr-only">Filter by tag</span><select aria-label="Filter by tag" value={tagId} onChange={(event) => { setTagId(event.target.value); setPage(1); }} className="p-input"><option value="">All tags</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="p-input"><option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></select></label><label><span className="sr-only">Filter featured countries</span><select value={featured} onChange={(event) => { setFeatured(event.target.value); setPage(1); }} className="p-input"><option value="">Featured: all</option><option value="true">Featured only</option><option value="false">Not featured</option></select></label><button type="button" onClick={resetFilters} className="p-btn p-btn--ghost p-btn--sm">Clear filters</button></section>
      <div className="mt-5">{loading ? <CatalogLoading label="Loading countries…" /> : error ? <CatalogError message={error} onRetry={() => { setError(''); setReload((value) => value + 1); }} /> : rows.length === 0 ? <div className="p-panel p-empty"><h3 className="p-empty__t">No countries found</h3><p className="p-empty__d">Create a core country record or adjust the filters.</p></div> : <div className="p-tablewrap">{/* Eleven columns forced a 1180px floor, so Actions sat off the right
        edge and Edit could only be reached by scrolling the table sideways.
        The six kept here are what the list is scanned for; ISO, tags, linked
        records, featured and order are all still edited in the country
        editor. */}<table className="p-table u-table"><thead><tr><th scope="col">Country</th><th scope="col">Continent</th><th scope="col">Subjects</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col" className="p-td-actions">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><span className="p-hint">/{row.slug}</span></td><td>{row.continent?.name ?? '—'}</td><td><TermList terms={row.subjects} empty="No subjects" /></td><td><span className={`p-badge ${row.status === 'PUBLISHED' ? 'p-badge--ok' : 'p-badge--visa'}`}>{row.status}</span></td><td>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : <span className="p-muted">—</span>}</td><td className="p-td-actions"><div className="p-row p-row--actions"><Link href={`/countries/${row.id}`} className="p-btn p-btn--ghost p-btn--sm">Edit</Link>{row.status === 'PUBLISHED' ? <button type="button" onClick={() => setPending({ kind: 'unpublish', country: row })} className="p-btn p-btn--ghost p-btn--sm">Unpublish</button> : <button type="button" onClick={() => setPending({ kind: 'publish', country: row })} className="p-btn p-btn--primary p-btn--sm">Publish</button>}<button type="button" onClick={() => setPending({ kind: 'delete', country: row })} className="p-btn p-btn--danger p-btn--sm">Delete</button></div></td></tr>)}</tbody></table></div>}</div>
      {meta && meta.totalPages > 1 ? <nav className="a-grid__pager" aria-label="Pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="p-btn p-btn--ghost p-btn--sm">Previous</button><span className="p-hint">Page {meta.page} of {meta.totalPages}</span><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="p-btn p-btn--ghost p-btn--sm">Next</button></nav> : null}
      {pending ? <CatalogDialog title={pending.kind === 'publish' ? 'Publish country?' : pending.kind === 'unpublish' ? 'Unpublish country?' : 'Delete country?'} description={pending.kind === 'publish' ? 'Publishing makes the core country record available to public country APIs.' : pending.kind === 'unpublish' ? 'Unpublishing removes this country from public APIs while preserving its content.' : 'This is a soft delete and removes the country from normal admin and public lists.'} onClose={() => { if (!working) { setPending(null); setPendingValue(''); } }}><p className="p-sub">{pending.kind === 'delete' ? <>Type <strong>{pending.country.name}</strong> to confirm this destructive action.</> : <>Confirm this action for <strong>{pending.country.name}</strong>.</>}</p>{pending.kind === 'delete' ? <input autoFocus value={pendingValue} onChange={(event) => setPendingValue(event.target.value)} placeholder={pending.country.name} className="p-input" /> : null}<div className="p-row p-row--wrap"><button type="button" disabled={working} onClick={() => { setPending(null); setPendingValue(''); }} className="p-btn p-btn--ghost">Cancel</button><button type="button" disabled={working || (pending.kind === 'delete' && pendingValue !== pending.country.name)} onClick={() => void performAction()} className={`p-btn ${pending.kind === 'delete' ? 'p-btn--danger' : 'p-btn--primary'}`}>{working ? 'Working…' : pending.kind === 'delete' ? 'Delete country' : pending.kind === 'publish' ? 'Publish country' : 'Unpublish country'}</button></div></CatalogDialog> : null}
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
    return <span className="p-muted">{empty}</span>;
  const shown = rows.slice(0, limit);
  const remaining = rows.length - shown.length;
  return (
    <span className="p-hint p-terms" title={rows.map((row) => row.name).join(', ')}>
      {shown.map((row) => row.name).join(', ')}
      {remaining > 0 ? ` +${remaining}` : ''}
    </span>
  );
}


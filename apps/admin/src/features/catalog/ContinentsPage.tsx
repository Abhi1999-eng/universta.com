'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { createContinent, deleteContinent, listContinents, updateContinent } from './catalog-client';
import type { ContinentRecord, PageMeta } from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

type FormState = { name: string; slug: string; code: string; description: string; displayOrder: string; status: string };
const emptyForm: FormState = { name: '', slug: '', code: '', description: '', displayOrder: '0', status: 'ACTIVE' };

function slug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-'); }

export function ContinentsPage() {
  const [rows, setRows] = useState<ContinentRecord[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ record?: ContinentRecord; values: FormState } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContinentRecord | null>(null);
  const [success, setSuccess] = useState('');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError('');
    return listContinents({ q, status, page, limit: 12 }, signal).then((result) => {
      setRows(result.data); setMeta(result.meta); setLoading(false);
    }).catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setLoading(false); setError(cause instanceof Error ? cause.message : 'Unable to load continents');
    });
  }, [page, q, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, reload]);

  function openCreate() { setForm({ values: emptyForm }); }
  function openEdit(record: ContinentRecord) {
    setForm({ record, values: { name: record.name, slug: record.slug, code: record.code ?? '', description: record.description ?? '', displayOrder: String(record.displayOrder), status: record.status } });
  }
  function updateField(key: keyof FormState, value: string) { setForm((current) => current ? { ...current, values: { ...current.values, [key]: value } } : current); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !form.values.name.trim()) return;
    try {
      const values = { name: form.values.name, slug: form.values.slug || slug(form.values.name), code: form.values.code || undefined, shortDescription: form.values.description || undefined, displayOrder: Number(form.values.displayOrder) || 0, status: form.values.status };
      if (form.record) await updateContinent(form.record.id, { ...values, expectedUpdatedAt: form.record.updatedAt });
      else await createContinent(values);
      setForm(null); setSuccess(form.record ? 'Continent updated.' : 'Continent created.'); setReload((value) => value + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to save continent'); }
  }
  async function remove() {
    if (!deleteTarget) return;
    try { await deleteContinent(deleteTarget.id, deleteTarget.updatedAt); setDeleteTarget(null); setSuccess('Continent deleted.'); setReload((value) => value + 1); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to delete continent'); setDeleteTarget(null); }
  }

  return (
    <section aria-labelledby="continents-heading" className="mx-auto max-w-[1180px]">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Catalog core</p><h2 id="continents-heading" className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Continents</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">Manage the active continents used by the country catalog. A continent with countries cannot be deleted.</p></div>
        <button type="button" onClick={openCreate} className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0F3FA0] focus:outline-none focus:ring-2 focus:ring-[#1657CF]">Create continent</button>
      </div>
      {success ? <p role="status" className="mt-5 rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]">{success}</p> : null}
      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[#E8ECF3] bg-white p-4 sm:flex-row"><label className="flex-1"><span className="sr-only">Search continents</span><input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Search by name, slug or code" className="w-full rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]" /></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-xl border border-[#D9E0EA] bg-white px-4 py-3 text-sm outline-none focus:border-[#1657CF] sm:w-40"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
      <div className="mt-5">{loading ? <CatalogLoading label="Loading continents…" /> : error ? <CatalogError message={error} onRetry={() => { setError(''); setReload((value) => value + 1); }} /> : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-[#C9D3E2] bg-white p-12 text-center"><h3 className="text-lg font-semibold">No continents found</h3><p className="mt-2 text-sm text-[#667085]">Try a different search or create the first catalog continent.</p></div> : <div className="overflow-hidden rounded-2xl border border-[#E8ECF3] bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#FAFBFD] text-xs uppercase tracking-[0.12em] text-[#828B9B]"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Code</th><th className="px-5 py-4">Countries</th><th className="px-5 py-4">Order</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#EEF1F5]">{rows.map((row) => <tr key={row.id}><td className="px-5 py-4"><p className="font-semibold text-[#0D1524]">{row.name}</p><p className="mt-1 text-xs text-[#828B9B]">/{row.slug}</p></td><td className="px-5 py-4 text-[#667085]">{row.code ?? '—'}</td><td className="px-5 py-4 text-[#667085]">{row.countriesCount}</td><td className="px-5 py-4 text-[#667085]">{row.displayOrder}</td><td className="px-5 py-4"><span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-xs font-semibold text-[#1657CF]">{row.status}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => openEdit(row)} className="mr-3 font-semibold text-[#1657CF] focus:outline-none focus:underline">Edit</button><button type="button" onClick={() => setDeleteTarget(row)} className="font-semibold text-[#B42318] focus:outline-none focus:underline">Delete</button></td></tr>)}</tbody></table></div></div>}</div>
      {meta && meta.totalPages > 1 ? <div className="mt-5 flex items-center justify-between text-sm"><span className="text-[#667085]">Page {meta.page} of {meta.totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 disabled:opacity-40">Next</button></div></div> : null}
      {form ? <CatalogDialog title={form.record ? 'Edit continent' : 'Create continent'} description="Use the existing continent fields. Slugs are stable identifiers for public region URLs." onClose={() => setForm(null)}><form onSubmit={(event) => void save(event)} className="space-y-4"><Field label="Name" value={form.values.name} onChange={(value) => updateField('name', value)} required helpKey="continents.name" /><Field label="Slug" value={form.values.slug} onChange={(value) => updateField('slug', value)} help="Lowercase letters, numbers and hyphens." required helpKey="continents.slug" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Code" value={form.values.code} onChange={(value) => updateField('code', value)} helpKey="continents.code" /><Field label="Display order" value={form.values.displayOrder} onChange={(value) => updateField('displayOrder', value)} type="number" helpKey="continents.displayOrder" /></div><Field label="Description" value={form.values.description} onChange={(value) => updateField('description', value)} textarea helpKey="continents.description" /><div className="block text-sm font-semibold"><FieldLabel label="Status" htmlFor="continent-status" help={commonFieldHelp.status} /><select id="continent-status" value={form.values.status} onChange={(event) => updateField('status', event.target.value)} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></div>{error ? <p role="alert" className="text-sm text-[#B42318]">{error}</p> : null}<div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setForm(null)} className="rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">Cancel</button><button type="submit" className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white">Save continent</button></div></form></CatalogDialog> : null}
      {deleteTarget ? <CatalogDialog title="Delete continent?" description="This is a soft delete. A continent containing countries cannot be deleted." onClose={() => setDeleteTarget(null)}><p className="text-sm text-[#48505F]">Type <strong>{deleteTarget.name}</strong> to confirm this deliberate action.</p><DeleteConfirm name={deleteTarget.name} onCancel={() => setDeleteTarget(null)} onConfirm={() => void remove()} /></CatalogDialog> : null}
    </section>
  );
}

function Field({ label, value, onChange, help, helpKey, required, type = 'text', textarea = false }: { label: string; value: string; onChange: (value: string) => void; help?: string; helpKey?: string; required?: boolean; type?: string; textarea?: boolean }) {
  // Explicit id/htmlFor, not a wrapping <label> — FieldLabel's help-icon
  // <button> breaks an implicitly-wrapping label's accessible-name link.
  // This form's required marker was already a real, non-hidden " *" before
  // this component existed — keep it visible (requiredMarkerVisible) rather
  // than switching to the decorative default.
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <FieldLabel label={label} htmlFor={fieldId} helpKey={helpKey} required={required} requiredMarkerVisible />
      {textarea ? <textarea id={fieldId} required={required} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]" /> : <input id={fieldId} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]" />}
      {help ? <span className="mt-1 block text-xs font-normal text-[#828B9B]">{help}</span> : null}
    </div>
  );
}

function DeleteConfirm({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  const [value, setValue] = useState('');
  return <div className="mt-5"><label className="block text-sm font-semibold">Confirmation<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder={name} className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-4 py-3 font-normal outline-none focus:border-[#1657CF]" /></label><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-[#D9E0EA] px-4 py-3 text-sm font-semibold">Cancel</button><button type="button" disabled={value !== name} onClick={onConfirm} className="rounded-xl bg-[#B42318] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Delete</button></div></div>;
}

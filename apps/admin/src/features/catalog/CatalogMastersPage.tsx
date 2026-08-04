'use client';

import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/features/auth/auth-client';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { createCourseLevel, createStudyMode, deleteCourseLevel, deleteStudyMode, listCourseLevels, listStudyModes, updateCourseLevel, updateStudyMode } from './catalog-client';
import type { CatalogMutationError, MasterRecord } from './catalog.types';
import { useSectionFocus } from '@/features/shell/use-section-focus';

type LookupKind = 'intake' | 'provider';
type LookupRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  monthNumber?: number | null;
  seasonName?: string | null;
  websiteUrl?: string | null;
  _count?: { scholarships?: number };
};
async function lookupApi<T>(kind: LookupKind, path: string, init?: RequestInit): Promise<T> {
  const base = kind === 'intake' ? '/api/v1/admin/intakes' : '/api/v1/admin/scholarship-providers';
  const response = await authFetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? 'Request failed');
  return body.data as T;
}

function LookupPanel({ title, kind }: { title: string; kind: LookupKind }) {
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [monthNumber, setMonthNumber] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [editing, setEditing] = useState<LookupRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    lookupApi<LookupRow[]>(kind, '?status=')
      .then(setRows)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : `Unable to load ${title.toLowerCase()}`))
      .finally(() => setLoading(false));
  }, [kind, title]);
  useEffect(() => {
    // The state update happens only after the asynchronous request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await lookupApi(kind, '', {
        method: 'POST',
        body: JSON.stringify(
          kind === 'intake'
            ? { name, monthNumber: monthNumber ? Number(monthNumber) : undefined }
            : { name, websiteUrl: websiteUrl || undefined },
        ),
      });
      setName(''); setMonthNumber(''); setWebsiteUrl(''); setCreating(false);
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to create record');
    }
  }

  async function toggle(row: LookupRow) {
    try {
      const next = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await lookupApi(kind, `/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to update status');
    }
  }

  async function remove(row: LookupRow) {
    const inUse = row._count?.scholarships ?? 0;
    const confirmMessage =
      inUse > 0
        ? `"${row.name}" is used by ${inUse} scholarship${inUse === 1 ? '' : 's'}. Archiving is blocked while scholarships still reference it — reassign or archive those scholarships first. Try anyway?`
        : `Archive "${row.name}"? Archiving removes it from normal active management views while preserving history — it is not the same as a permanent delete.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await lookupApi(kind, `/${row.id}`, { method: 'DELETE' });
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to archive record');
    }
  }

  function startEdit(row: LookupRow) {
    setEditing(row);
    setEditName(row.name);
    setEditWebsiteUrl(row.websiteUrl ?? '');
    setCreating(false);
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setError('');
    try {
      await lookupApi(kind, `/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          kind === 'intake' ? { name: editName } : { name: editName, websiteUrl: editWebsiteUrl || null },
        ),
      });
      setEditing(null);
      load();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Unable to save changes');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Master data</p>
          <h3 className="mt-2 text-xl font-semibold">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setCreating((v) => !v);
          }}
          className="rounded-xl bg-[#1657CF] px-3 py-2 text-sm font-semibold text-white"
        >
          {creating ? 'Close' : 'Add'}
        </button>
      </div>
      {kind === 'provider' ? (
        <p className="mt-3 text-xs leading-5 text-[#828B9B]">
          Deactivate keeps the provider and its scholarships, just prevents new selection. Archive removes it from
          normal management views while preserving history — it is blocked while any scholarship still references it.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-xs font-semibold text-[#B42318]">{error}</p> : null}
      {editing ? (
        <form onSubmit={(event) => void saveEdit(event)} className="mt-4 space-y-3 rounded-xl border border-[#E8ECF3] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Editing: {editing.name}</p>
          <label className="block text-sm font-semibold">Name
            <input required className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          {kind === 'provider' ? (
            <label className="block text-sm font-semibold">Website URL (optional)
              <input className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={editWebsiteUrl} onChange={(event) => setEditWebsiteUrl(event.target.value)} />
            </label>
          ) : null}
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">Cancel</button>
            <button disabled={editSaving} className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{editSaving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      ) : null}
      {creating ? (
        <form onSubmit={(event) => void create(event)} className="mt-4 space-y-3 rounded-xl border border-[#E8ECF3] p-4">
          <label className="block text-sm font-semibold">Name
            <input required className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {kind === 'intake' ? (
            <label className="block text-sm font-semibold">Month number (1-12, optional)
              <input type="number" min="1" max="12" className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={monthNumber} onChange={(event) => setMonthNumber(event.target.value)} />
            </label>
          ) : (
            <label className="block text-sm font-semibold">Website URL (optional)
              <input className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
            </label>
          )}
          <button className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      ) : null}
      {loading ? (
        <p className="mt-5 text-sm text-[#667085]">Loading…</p>
      ) : (
        <div className="mt-5 divide-y divide-[#E8ECF3]">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="mt-1 text-xs text-[#828B9B]">
                  {row.status}
                  {kind === 'provider' ? ` · Used by ${row._count?.scholarships ?? 0} scholarship${(row._count?.scholarships ?? 0) === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">
                  Edit
                </button>
                <button type="button" onClick={() => void toggle(row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">
                  {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => void remove(row)} className="rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318]">
                  Archive
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="mt-4 text-sm text-[#667085]">No records found.</p> : null}
        </div>
      )}
    </section>
  );
}

type Kind = 'level' | 'mode';
type Pending = { kind: Kind; row: MasterRecord } | null;
const empty = { code: '', name: '', description: '', displayOrder: '0', educationOrder: '0' };

export function CatalogMastersPage() {
  const focused = useSectionFocus(['course-levels', 'study-modes', 'intakes', 'scholarship-providers'] as const);
  const [levels, setLevels] = useState<MasterRecord[]>([]); const [modes, setModes] = useState<MasterRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [kind, setKind] = useState<Kind>('level'); const [editorOpen, setEditorOpen] = useState(false); const [editing, setEditing] = useState<MasterRecord | null>(null); const [form, setForm] = useState(empty); const [pending, setPending] = useState<Pending>(null);
  const load = useCallback(() => { setLoading(true); setError(''); void Promise.all([listCourseLevels({ limit: 100 }), listStudyModes({ limit: 100 })]).then(([left, right]) => { setLevels(left.data); setModes(right.data); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load catalog masters')).finally(() => setLoading(false)); }, []);
  useEffect(() => { const timer = window.setTimeout(() => load(), 0); return () => window.clearTimeout(timer); }, [load]);
  function open(kindValue: Kind, row?: MasterRecord) { setKind(kindValue); setEditing(row ?? null); setForm(row ? { code: row.code, name: row.name, description: row.description ?? '', displayOrder: String(row.displayOrder), educationOrder: String(row.educationOrder ?? 0) } : { ...empty }); setEditorOpen(true); }
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); const data = { code: form.code, name: form.name, description: form.description || undefined, displayOrder: Number(form.displayOrder) || 0, ...(kind === 'level' ? { educationOrder: Number(form.educationOrder) || 0 } : {}), ...(editing ? { expectedUpdatedAt: editing.updatedAt } : {}) }; try { if (kind === 'level') { if (editing) await updateCourseLevel(editing.id, data); else await createCourseLevel(data); } else if (editing) await updateStudyMode(editing.id, data); else await createStudyMode(data); setEditing(null); setEditorOpen(false); load(); } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to save master record'); } finally { setSaving(false); } }
  async function remove() { if (!pending) return; try { if (pending.kind === 'level') await deleteCourseLevel(pending.row.id, pending.row.updatedAt); else await deleteStudyMode(pending.row.id, pending.row.updatedAt); setPending(null); load(); } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to delete master record'); setPending(null); } }
  async function toggle(row: MasterRecord, panelKind: Kind) { try { const data = { status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', expectedUpdatedAt: row.updatedAt }; if (panelKind === 'level') await updateCourseLevel(row.id, data); else await updateStudyMode(row.id, data); load(); } catch (cause: unknown) { const typed = cause as Partial<CatalogMutationError>; setError(typed.message ?? 'Unable to change master status'); } }
  function panel(title: string, panelKind: Kind, rows: MasterRecord[]) { return <section className="rounded-2xl border border-[#E8ECF3] bg-white p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Master data</p><h3 className="mt-2 text-xl font-semibold">{title}</h3></div><button type="button" onClick={() => open(panelKind)} className="rounded-xl bg-[#1657CF] px-3 py-2 text-sm font-semibold text-white">Add</button></div><div className="mt-5 divide-y divide-[#E8ECF3]">{rows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-[#828B9B]">{row.code} · {row.status}</p></div><div className="flex gap-2"><button type="button" onClick={() => open(panelKind, row)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">Edit</button><button type="button" onClick={() => void toggle(row, panelKind)} className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-sm font-semibold">{row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => setPending({ kind: panelKind, row })} className="rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318]">Delete</button></div></div>)}</div>{rows.length === 0 ? <p className="mt-4 text-sm text-[#667085]">No records found.</p> : null}</section>; }
  const show = (section: string) => !focused || focused === section;
  return <section aria-labelledby="masters-heading" className="mx-auto max-w-[1180px]"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Catalog foundations</p><h2 id="masters-heading" className="mt-2 text-3xl font-semibold">{focused ? ({'course-levels':'Course levels','study-modes':'Study modes',intakes:'Intakes','scholarship-providers':'Scholarship providers'} as const)[focused] : 'Course levels, study modes, intakes and scholarship providers'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#667085]">Maintain the active master values used by course editors and public filters. Dependencies are checked before deactivation or deletion.</p>{error ? <div className="mt-5"><CatalogError message={error} onRetry={load} /></div> : null}{loading ? <div className="mt-8"><CatalogLoading label="Loading master data…" /></div> : <div className="mt-8 grid gap-6 lg:grid-cols-2">{show('course-levels') ? panel('Course levels', 'level', levels) : null}{show('study-modes') ? panel('Study modes', 'mode', modes) : null}{show('intakes') ? <LookupPanel title="Intakes" kind="intake" /> : null}{show('scholarship-providers') ? <LookupPanel title="Scholarship providers" kind="provider" /> : null}</div>}{editorOpen ? <CatalogDialog title={`${editing ? 'Edit' : 'Add'} ${kind === 'level' ? 'course level' : 'study mode'}`} description="Use stable codes because courses and integrations reference them." onClose={() => { setEditing(null); setEditorOpen(false); }}><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Code<input required pattern="[A-Z0-9_-]+" className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label><label className="text-sm font-semibold">Name<input required className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label></div><label className="block text-sm font-semibold">Description<textarea className="mt-2 min-h-20 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Display order<input type="number" min="0" className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></label>{kind === 'level' ? <label className="text-sm font-semibold">Education order<input type="number" min="0" className="mt-2 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal" value={form.educationOrder} onChange={(event) => setForm({ ...form, educationOrder: event.target.value })} /></label> : null}</div><div className="flex justify-end gap-3"><button type="button" onClick={() => { setEditing(null); setEditorOpen(false); }} className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-lg bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div></form></CatalogDialog> : null}{pending ? <CatalogDialog title="Delete master record?" description="Deletion is blocked when courses reference this record; deactivate it when dependencies remain." onClose={() => setPending(null)}><div className="flex justify-end gap-3"><button type="button" onClick={() => setPending(null)} className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void remove()} className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white">Delete</button></div></CatalogDialog> : null}</section>;
}

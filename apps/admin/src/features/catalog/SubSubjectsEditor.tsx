'use client';

import { useCallback, useEffect, useState } from 'react';
import { CatalogDialog, CatalogError, CatalogLoading } from './CatalogDialog';
import { createSubSubject, deleteSubSubject, listSubSubjects } from './catalog-client';
import type { CatalogMutationError, SubSubjectRecord } from './catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';

export function SubSubjectsEditor({ subjectId }: { subjectId: string }) {
  const [rows, setRows] = useState<SubSubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<SubSubjectRecord | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    void listSubSubjects(subjectId)
      .then((result) => setRows(result.data))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load Sub-Subjects'))
      .finally(() => setLoading(false));
  }, [subjectId]);

  useEffect(() => { const timer = window.setTimeout(() => load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createSubSubject(subjectId, { name: name.trim(), ...(slug.trim() ? { slug: slug.trim() } : {}) });
      setName('');
      setSlug('');
      load();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Unable to create Sub-Subject');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!pending) return;
    try {
      await deleteSubSubject(subjectId, pending.id, pending.updatedAt);
      setPending(null);
      load();
    } catch (cause: unknown) {
      const typed = cause as Partial<CatalogMutationError>;
      setError(typed.message ?? 'Unable to delete Sub-Subject');
      setPending(null);
    }
  }

  return <section aria-labelledby="subsubjects-heading" className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Subject structure</p><h3 id="subsubjects-heading" className="mt-2 text-xl font-semibold">Sub-Subjects</h3><p className="mt-2 text-sm text-[#667085]">Add child pathways without exposing draft records publicly.</p></div>
    </div>
    {error ? <div className="mt-4"><CatalogError message={error} onRetry={load} /></div> : null}
    <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <div className="text-sm font-semibold"><FieldLabel label="Name" htmlFor="subsubject-name" required help={commonFieldHelp.name} /><input id="subsubject-name" required className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal" value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="text-sm font-semibold"><FieldLabel label="Slug" htmlFor="subsubject-slug" help={commonFieldHelp.slug} /><input id="subsubject-slug" className="mt-2 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 font-normal" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Generated from name" /></div>
      <button disabled={saving} className="self-end rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Adding…' : 'Add draft'}</button>
    </form>
    {loading ? <div className="mt-5"><CatalogLoading label="Loading Sub-Subjects…" /></div> : rows.length ? <div className="mt-5 divide-y divide-[#E8ECF3] rounded-xl border border-[#E8ECF3]">{rows.map((row) => <div key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-[#828B9B]">/{row.slug} · {row.status}</p></div><button type="button" onClick={() => setPending(row)} className="self-start rounded-lg border border-[#F2C5C5] px-3 py-2 text-sm font-semibold text-[#B42318] sm:self-auto">Delete</button></div>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-[#CBD5E4] p-6 text-center text-sm text-[#667085]">No Sub-Subjects yet.</p>}
    {pending ? <CatalogDialog title="Delete Sub-Subject?" description="This removes the draft record only when it is not referenced by a course." onClose={() => setPending(null)}><div className="flex justify-end gap-3"><button type="button" onClick={() => setPending(null)} className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void remove()} className="rounded-lg bg-[#B42318] px-4 py-2 text-sm font-semibold text-white">Delete</button></div></CatalogDialog> : null}
  </section>;
}

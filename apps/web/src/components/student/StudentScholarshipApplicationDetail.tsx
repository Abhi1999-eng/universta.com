'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';

type Item = Record<string, unknown>;
const label = (status: unknown) => String(status ?? '').toLowerCase().replaceAll('_', ' ');

export function StudentScholarshipApplicationDetail({ id }: { id: string }) {
  const { api } = useStudentSession();
  const [application, setApplication] = useState<Item | null>(null);
  const [documents, setDocuments] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [next, ownDocuments] = await Promise.all([
        api<Item>(`/scholarship-applications/${id}`),
        api<Item[]>('/documents'),
      ]);
      setApplication(next);
      setDocuments(ownDocuments);
    } catch (cause) { setError((cause as Error).message); }
  }, [api, id]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const action = async (path: string, body?: Item) => {
    setBusy(true); setError('');
    try {
      await api(path, { method: 'POST', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      setSelected([]); await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  if (!application) return <p className="stu-empty">Loading scholarship application…</p>;
  const status = String(application.status);
  const attached = (application.documents as Item[] | undefined) ?? [];
  const timeline = (application.timeline as Item[] | undefined) ?? [];
  return <>
    <h1>{String((application.scholarship as Item | undefined)?.title ?? application.scholarshipTitleSnapshot)}</h1>
    <p className="lede">{label(status)}</p>
    {error ? <p className="stu-alert error" role="alert">{error}</p> : null}
    <section className="stu-card"><h2>Progress</h2><ol className="stu-timeline">{timeline.map((entry) => <li key={String(entry.id)}><strong>{label(entry.status)}</strong><span>{String(entry.message ?? '')}</span></li>)}</ol>{status === 'STARTED' ? <button className="stu-btn" disabled={busy} onClick={() => void action(`/scholarship-applications/${id}/submit`)}>Submit application</button> : null}{['STARTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(status) ? <button className="stu-btn ghost" disabled={busy} onClick={() => void action(`/scholarship-applications/${id}/withdraw`)}>Withdraw</button> : null}</section>
    <section className="stu-card"><h2>Documents</h2>{attached.length ? <ul className="stu-list">{attached.map((entry) => <li key={String(entry.studentDocumentId)}>{String((entry.studentDocument as Item)?.title ?? 'Document')}</li>)}</ul> : <p className="stu-empty">No documents attached yet.</p>}<fieldset className="stu-field"><legend>Attach your uploaded documents</legend>{documents.map((document) => <label className="stu-choice" key={String(document.id)}><input type="checkbox" checked={selected.includes(String(document.id))} onChange={() => setSelected((current) => current.includes(String(document.id)) ? current.filter((value) => value !== String(document.id)) : [...current, String(document.id)])} /> {String(document.title)}</label>)}<button type="button" className="stu-btn ghost" disabled={!selected.length || busy} onClick={() => void action(`/scholarship-applications/${id}/documents`, { documentIds: selected })}>Attach selected</button></fieldset></section>
  </>;
}

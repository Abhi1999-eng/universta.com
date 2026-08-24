'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useStudentSession } from './StudentSession';

type Item = Record<string, unknown>;

const labels: Record<string, string> = {
  APPLICATION_STARTED: 'Application started',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  OFFER_RECEIVED: 'Offer received',
  ACCEPTED: 'Offer accepted',
  REJECTED: 'Not successful',
  WITHDRAWN: 'Withdrawn',
  ENROLLED: 'Enrolled',
};

function label(value: unknown) {
  const key = String(value ?? '');
  return labels[key] ?? key.toLowerCase().replaceAll('_', ' ');
}

export function StudentApplicationDetail({ id }: { id: string }) {
  const { api, apiFile } = useStudentSession();
  const [application, setApplication] = useState<Item | null>(null);
  const [documents, setDocuments] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [next, ownDocuments] = await Promise.all([
        api<Item>(`/applications/${id}`),
        api<Item[]>('/documents'),
      ]);
      setApplication(next);
      setDocuments(ownDocuments);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [api, id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const action = async (path: string, body?: Item) => {
    setBusy(true);
    setError('');
    try {
      await api(path, {
        method: 'POST',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      setSelected([]);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const downloadOffer = async () => {
    setBusy(true);
    try {
      const file = await apiFile(`/applications/${id}/offer`);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = String((application?.offerMedia as Item | undefined)?.originalFileName ?? 'offer-letter');
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError((cause as Error).message);
    } finally { setBusy(false); }
  };

  if (!application) return <p className="stu-empty">Loading application…</p>;
  const status = String(application.status);
  const offering = application.offering as Item | undefined;
  const university = application.university as Item | undefined;
  const timeline = (application.timeline as Item[] | undefined) ?? [];
  const attached = (application.documents as Item[] | undefined) ?? [];
  const offer = application.offerMedia as Item | undefined;
  return (
    <>
      <h1>{String(offering?.name ?? application.offeringNameSnapshot ?? 'Application')}</h1>
      <p className="lede">{String(university?.name ?? application.universityNameSnapshot ?? '')} · {label(status)}</p>
      {error ? <p className="stu-alert error" role="alert">{error}</p> : null}
      <section className="stu-card">
        <h2>Application progress</h2>
        <ol className="stu-timeline">
          {timeline.map((entry) => <li key={String(entry.id)}><strong>{label(entry.status)}</strong><span>{String(entry.message ?? '')}</span></li>)}
        </ol>
        <div className="stu-actions">
          {status === 'APPLICATION_STARTED' ? <button className="stu-btn" disabled={busy} onClick={() => void action(`/applications/${id}/submit`)}>Submit application</button> : null}
          {['APPLICATION_STARTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(status) ? <button className="stu-btn ghost" disabled={busy} onClick={() => void action(`/applications/${id}/withdraw`)}>Withdraw</button> : null}
        </div>
      </section>
      <section className="stu-card">
        <h2>Documents</h2>
        {attached.length ? <ul className="stu-list">{attached.map((entry) => <li key={String(entry.studentDocumentId)}>{String((entry.studentDocument as Item)?.title ?? 'Document')}</li>)}</ul> : <p className="stu-empty">No documents attached yet.</p>}
        {documents.length ? <fieldset className="stu-field"><legend>Attach your uploaded documents</legend>{documents.map((document) => <label className="stu-choice" key={String(document.id)}><input type="checkbox" checked={selected.includes(String(document.id))} onChange={() => setSelected((current) => current.includes(String(document.id)) ? current.filter((value) => value !== String(document.id)) : [...current, String(document.id)])} /> {String(document.title)}</label>)}<button type="button" className="stu-btn ghost" disabled={!selected.length || busy} onClick={() => void action(`/applications/${id}/documents`, { documentIds: selected })}>Attach selected</button></fieldset> : <Link className="stu-btn ghost" href="/student/documents">Upload a document</Link>}
      </section>
      {offer ? <section className="stu-card"><h2>Offer letter available</h2><p>{String(offer.originalFileName)}</p><button className="stu-btn ghost" disabled={busy} onClick={() => void downloadOffer()}>Download offer letter</button>{status === 'OFFER_RECEIVED' ? <div className="stu-actions"><button className="stu-btn" disabled={busy} onClick={() => void action(`/applications/${id}/offer-decision`, { decision: 'ACCEPTED' })}>Accept offer</button><button className="stu-btn ghost" disabled={busy} onClick={() => void action(`/applications/${id}/offer-decision`, { decision: 'REJECTED' })}>Reject offer</button></div> : null}</section> : null}
    </>
  );
}

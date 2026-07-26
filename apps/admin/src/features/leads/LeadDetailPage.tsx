'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  createLeadNote,
  getLead,
  getLeadOptions,
  updateLeadStatus,
} from './leads-client';
import {
  LeadClientError,
  type LeadDetail,
  type LeadOptions,
} from './leads.types';
import { StatusPill } from './LeadsPage';

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function person(
  value: { firstName: string; lastName: string | null; email: string } | null,
): string {
  return value
    ? [value.firstName, value.lastName].filter(Boolean).join(' ') || value.email
    : 'System';
}

function label(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function LeadDetailPage({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [options, setOptions] = useState<LeadOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [statusWorking, setStatusWorking] = useState(false);
  const [note, setNote] = useState('');
  const [pinned, setPinned] = useState(false);
  const [noteWorking, setNoteWorking] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError('');
      setNotFound(false);
      try {
        const [record, loadedOptions] = await Promise.all([
          getLead(leadId, signal),
          getLeadOptions(signal),
        ]);
        setLead(record);
        setOptions(loadedOptions);
        setStatus(record.status);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        if (cause instanceof LeadClientError && cause.status === 404) {
          setNotFound(true);
        } else {
          setError(
            cause instanceof Error ? cause.message : 'Unable to load lead.',
          );
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [leadId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reload]);

  async function saveStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || statusWorking || status === lead.status) return;
    setStatusWorking(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateLeadStatus(lead.id, status, lead.updatedAt, reason);
      setReason('');
      setActionMessage('Lead status updated.');
      setReload((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Status could not be updated.',
      );
    } finally {
      setStatusWorking(false);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lead || noteWorking || !note.trim()) return;
    setNoteWorking(true);
    setActionError('');
    setActionMessage('');
    try {
      await createLeadNote(lead.id, note, pinned);
      setNote('');
      setPinned(false);
      setActionMessage('Internal note added.');
      setReload((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Note could not be added.',
      );
    } finally {
      setNoteWorking(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-[1120px] rounded-2xl border border-[#E8ECF3] bg-white p-10 text-center text-sm text-[#667085]" role="status">Loading lead…</p>;
  }
  if (notFound) {
    return (
      <section className="mx-auto max-w-[760px] rounded-2xl border border-[#E8ECF3] bg-white p-8 text-center">
        <h2 className="text-2xl font-semibold">Lead not found</h2>
        <p className="mt-3 text-sm text-[#667085]">This lead may have been removed or is no longer available.</p>
        <Link href="/leads" className="mt-5 inline-flex rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white">Back to leads</Link>
      </section>
    );
  }
  if (error || !lead) {
    return (
      <section className="mx-auto max-w-[760px] rounded-2xl border border-[#F3C7C7] bg-[#FFF7F7] p-8" role="alert">
        <h2 className="text-xl font-semibold text-[#9F1D1D]">Lead could not be loaded</h2>
        <p className="mt-2 text-sm text-[#7A3232]">{error}</p>
        <button type="button" onClick={() => setReload((value) => value + 1)} className="mt-5 rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white">Retry</button>
      </section>
    );
  }

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  return (
    <section aria-labelledby="lead-heading" className="mx-auto max-w-[1120px]">
      <Link href="/leads" className="text-sm font-semibold text-[#1657CF] hover:underline">← Back to leads</Link>
      <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">{lead.leadNumber}</p>
          <h2 id="lead-heading" className="mt-2 break-words text-3xl font-semibold tracking-[-0.04em]">{name}</h2>
          <p className="mt-2 text-sm text-[#667085]">Created {dateTime(lead.createdAt)} · Updated {dateTime(lead.updatedAt)}</p>
        </div>
        <StatusPill status={lead.status} />
      </div>
      {actionMessage ? <p role="status" className="mt-5 rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]">{actionMessage}</p> : null}
      {actionError ? <div role="alert" className="mt-5 rounded-xl border border-[#F3C7C7] bg-[#FFF7F7] px-4 py-3 text-sm text-[#9F1D1D]"><p>{actionError}</p><button type="button" onClick={() => setReload((value) => value + 1)} className="mt-2 font-semibold underline">Reload current lead</button></div> : null}

      <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Panel title="Contact details">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Fact label="Full name" value={name} />
              <Fact label="Email" value={lead.email ?? 'Not provided'} />
              <Fact label="Phone" value={`${lead.phoneCountryCode ?? ''}${lead.phoneNumber}`} />
              <Fact label="Consent" value={lead.privacyConsent ? 'Contact consent recorded' : 'Not recorded'} />
            </dl>
          </Panel>
          <Panel title="Counselling interests">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Fact label="Country" value={lead.preferredCountry?.name ?? 'Not selected'} />
              <Fact label="Study level" value={lead.preferredCourseLevel?.name ?? 'Not selected'} />
              <Fact label="Intake" value={lead.preferredIntake?.shortLabel ?? lead.preferredIntake?.name ?? 'Not selected'} />
              <Fact label="Subject" value={lead.preferredSubject?.name ?? 'Not selected'} />
              <Fact label="Course" value={lead.preferredCourse?.name ?? 'Not selected'} />
            </dl>
            {lead.message ? <div className="mt-6 border-t border-[#EEF1F5] pt-5"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">Student message</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#48505F]">{lead.message}</p></div> : null}
          </Panel>
          <Panel title="Source context">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Fact label="Source type" value={label(lead.sourceType ?? 'GENERAL')} />
              <Fact label="Source page" value={lead.sourcePageUrl ?? 'General entry'} />
              <Fact label="Landing page" value={lead.landingPageUrl ?? 'Not recorded'} />
              <Fact label="Referring path" value={lead.referrerUrl ?? 'Not recorded'} />
              <Fact label="UTM source" value={lead.utmSource ?? 'Not recorded'} />
              <Fact label="UTM campaign" value={lead.utmCampaign ?? 'Not recorded'} />
            </dl>
          </Panel>
          <Panel title="Internal notes">
            <form onSubmit={addNote}>
              <label className="grid gap-2 text-sm font-semibold text-[#48505F]">
                Add internal note
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={5000} rows={5} className="lead-control resize-y" placeholder="Add follow-up context for the Admin team" />
              </label>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#828B9B]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Pin note</label>
                <span>{note.length}/5,000</span>
              </div>
              <button type="submit" disabled={noteWorking || !note.trim()} className="mt-4 rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{noteWorking ? 'Adding note…' : 'Add note'}</button>
            </form>
            <div className="mt-6 grid gap-3">
              {lead.notes.length ? lead.notes.map((item) => (
                <article className="rounded-xl border border-[#E8ECF3] bg-[#FAFBFD] p-4" key={item.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="text-xs font-semibold text-[#48505F]">{person(item.user)}{item.isPinned ? ' · Pinned' : ''}</p>
                    <time className="text-xs text-[#828B9B]">{dateTime(item.createdAt)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#334155]">{item.note}</p>
                </article>
              )) : <p className="text-sm text-[#667085]">No internal notes yet.</p>}
            </div>
          </Panel>
        </div>

        <aside className="grid min-w-0 content-start gap-6">
          <Panel title="Update status">
            <form onSubmit={saveStatus}>
              <label className="grid gap-2 text-sm font-semibold text-[#48505F]">
                Current status
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="lead-control">
                  {options?.statuses.map((value) => <option value={value} key={value}>{label(value)}</option>)}
                </select>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-[#48505F]">
                Reason (optional)
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="lead-control resize-y" />
              </label>
              <button type="submit" disabled={statusWorking || status === lead.status} className="mt-4 w-full rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{statusWorking ? 'Updating…' : 'Update status'}</button>
            </form>
          </Panel>
          <Panel title="Status history">
            <div className="grid gap-4">
              {lead.statusHistory.map((item) => (
                <article className="border-l-2 border-[#DCE8FF] pl-4" key={item.id}>
                  <p className="text-sm font-semibold">{item.oldStatus ? `${label(item.oldStatus)} → ` : ''}{label(item.newStatus)}</p>
                  <p className="mt-1 text-xs text-[#667085]">{person(item.changedBy)} · {dateTime(item.createdAt)}</p>
                  {item.reason ? <p className="mt-2 break-words text-xs leading-5 text-[#48505F]">{item.reason}</p> : null}
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Audit history">
            <div className="grid gap-4">
              {lead.audit.length ? lead.audit.map((item) => (
                <article className="border-l-2 border-[#E8ECF3] pl-4" key={item.id}>
                  <p className="text-sm font-semibold">{label(item.action)}</p>
                  <p className="mt-1 text-xs text-[#667085]">{person(item.user)} · {dateTime(item.createdAt)}</p>
                  {item.description ? <p className="mt-2 text-xs leading-5 text-[#48505F]">{item.description}</p> : null}
                </article>
              )) : <p className="text-sm text-[#667085]">No audit events recorded.</p>}
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-[#E8ECF3] bg-white p-5 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label: title, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">{title}</dt>
      <dd className="mt-1 break-words text-sm leading-6 text-[#334155]">{value}</dd>
    </div>
  );
}

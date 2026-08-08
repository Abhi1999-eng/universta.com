'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getLead,
  getLeadOptions,
  updateLeadConsultantAssignment,
} from './leads-client';
import type {
  LeadAssignedConsultant,
  LeadConsultantOption,
} from './leads.types';

export function LeadConsultantAssignmentCard({ leadId }: { leadId: string }) {
  const [consultants, setConsultants] = useState<LeadConsultantOption[]>([]);
  const [assigned, setAssigned] = useState<LeadAssignedConsultant | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [lead, options] = await Promise.all([
        getLead(leadId),
        getLeadOptions(),
      ]);
      setConsultants(options.consultants ?? []);
      setAssigned(lead.assignedConsultant);
      setSelectedId(lead.assignedConsultant?.id ?? '');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load consultant assignment.',
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveAssignment() {
    if (working) return;
    const nextConsultantId = selectedId || null;
    if ((assigned?.id ?? null) === nextConsultantId) return;

    setWorking(true);
    setMessage('');
    setError('');
    try {
      const latest = await getLead(leadId);
      await updateLeadConsultantAssignment(
        leadId,
        nextConsultantId,
        latest.updatedAt,
      );
      setMessage(
        nextConsultantId
          ? assigned
            ? 'Lead reassigned successfully.'
            : 'Lead assigned successfully.'
          : 'Lead unassigned successfully.',
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Assignment could not be saved.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function unassign() {
    if (!assigned || working) return;
    setWorking(true);
    setMessage('');
    setError('');
    try {
      const latest = await getLead(leadId);
      await updateLeadConsultantAssignment(leadId, null, latest.updatedAt);
      setMessage('Lead unassigned successfully.');
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Lead could not be unassigned.',
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="mx-auto mb-6 max-w-[1120px] rounded-2xl border border-[#DCE8FF] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1657CF]">
            Lead routing
          </p>
          <h2 className="mt-2 text-xl font-semibold">Consultant assignment</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Assign this lead to a consultant. The same assignment can be used by
            the consultant panel when that panel is introduced later.
          </p>
        </div>
        {assigned ? (
          <div className="rounded-xl bg-[#F7F9FC] px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">
              Currently assigned
            </p>
            <p className="mt-1 font-semibold text-[#0D1524]">{assigned.name}</p>
          </div>
        ) : (
          <span className="rounded-full bg-[#FFF5E8] px-3 py-1.5 text-xs font-semibold text-[#9A5B00]">
            Unassigned
          </span>
        )}
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-[#667085]" role="status">
          Loading consultants…
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold text-[#48505F]">
            Assign to consultant
            <select
              className="lead-control"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={working}
            >
              <option value="">Unassigned</option>
              {consultants.map((consultant) => (
                <option key={consultant.id} value={consultant.id}>
                  {consultant.name}
                  {consultant.status !== 'PUBLISHED'
                    ? ` (${consultant.status})`
                    : ''}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void saveAssignment()}
            disabled={
              working || (assigned?.id ?? '') === selectedId || consultants.length === 0
            }
            className="rounded-xl bg-[#1657CF] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working ? 'Saving…' : assigned ? 'Save reassignment' : 'Assign lead'}
          </button>

          {assigned ? (
            <button
              type="button"
              onClick={() => void unassign()}
              disabled={working}
              className="rounded-xl border border-[#F3C7C7] px-5 py-3 text-sm font-semibold text-[#B42318] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unassign
            </button>
          ) : null}
        </div>
      )}

      {!loading && consultants.length === 0 ? (
        <p className="mt-3 text-sm text-[#9A5B00]">
          No consultants are available yet. Create a consultant first, then
          return to this lead.
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-xl bg-[#E9F8F0] px-4 py-3 text-sm font-semibold text-[#18794E]" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-[#F3C7C7] bg-[#FFF7F7] px-4 py-3 text-sm text-[#9F1D1D]" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 font-semibold underline"
          >
            Reload assignment
          </button>
        </div>
      ) : null}
    </section>
  );
}

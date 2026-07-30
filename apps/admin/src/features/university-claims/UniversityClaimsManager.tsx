"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type ClaimRow = {
  id: string;
  claimNumber: string;
  claimantName: string;
  workEmail: string;
  status: string;
  createdAt: string;
  university: { id: string; name: string; slug: string };
};
type NoteRow = { id: string; note: string; createdAt: string; user?: { firstName?: string; lastName?: string } };
type HistoryRow = {
  id: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string | null;
  createdAt: string;
  changedBy?: { firstName?: string; lastName?: string };
};
type ClaimDetail = ClaimRow & {
  jobTitle: string | null;
  organization: string | null;
  phoneNumber: string | null;
  officialWebsite: string | null;
  message: string;
  notes: NoteRow[];
  statusHistory: HistoryRow[];
};

const STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/university-claims${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

function personName(person?: { firstName?: string; lastName?: string }) {
  if (!person) return "System";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Admin";
}

export function UniversityClaimsManager() {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClaimDetail | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    try {
      const query = statusFilter ? `?status=${statusFilter}` : "";
      setClaims(await api<ClaimRow[]>(query));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load claims");
    }
  }, [statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function selectClaim(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await api<ClaimDetail>(`/${id}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load claim");
    }
  }

  async function updateStatus(status: string) {
    if (!selectedId) return;
    try {
      await api(`/${selectedId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: reason.trim() || undefined }),
      });
      setReason("");
      setMessage("Status updated.");
      await load();
      await selectClaim(selectedId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status");
    }
  }

  async function addNote() {
    if (!selectedId || !noteText.trim()) return;
    try {
      await api(`/${selectedId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText("");
      await selectClaim(selectedId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add note");
    }
  }

  async function archive() {
    if (!selectedId) return;
    try {
      await api(`/${selectedId}`, { method: "DELETE" });
      setMessage("Claim archived.");
      setSelectedId(null);
      setDetail(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive claim");
    }
  }

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Trust & partnerships</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">University claim requests</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Review requests to take ownership of a published university listing. Approving a
          request never creates admin or partner-portal access on its own.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm font-semibold" htmlFor="claim-status-filter">
          Filter by status
        </label>
        <select
          id="claim-status-filter"
          className="rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[420px_1fr]">
        <div className="space-y-3">
          {claims.map((claim) => (
            <button
              key={claim.id}
              type="button"
              onClick={() => void selectClaim(claim.id)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                selectedId === claim.id
                  ? "border-[#1657CF] bg-[#F0F4FA]"
                  : "border-[#E8ECF3] bg-white hover:bg-[#F7F9FC]"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{claim.claimantName}</p>
                <span className="rounded-full bg-[#EEF2F8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#48505F]">
                  {claim.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#828B9B]">{claim.university.name}</p>
              <p className="mt-1 font-mono text-[11px] text-[#9AA3B2]">{claim.claimNumber}</p>
            </button>
          ))}
          {claims.length === 0 ? <p className="text-sm text-[#667085]">No claim requests yet.</p> : null}
        </div>

        {detail ? (
          <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{detail.claimantName}</h3>
                <p className="text-xs text-[#828B9B]">
                  Claiming <strong>{detail.university.name}</strong> · {detail.workEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void archive()}
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700"
              >
                Archive
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[#828B9B]">Job title</dt><dd>{detail.jobTitle ?? "—"}</dd></div>
              <div><dt className="text-[#828B9B]">Organization</dt><dd>{detail.organization ?? "—"}</dd></div>
              <div><dt className="text-[#828B9B]">Phone</dt><dd>{detail.phoneNumber ?? "—"}</dd></div>
              <div><dt className="text-[#828B9B]">Official website</dt><dd>{detail.officialWebsite ?? "—"}</dd></div>
            </dl>
            <p className="mt-4 rounded-xl bg-[#F7F9FC] p-4 text-sm">{detail.message}</p>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <label className="text-sm font-semibold" htmlFor="status-reason">
                  Reason for status change (optional)
                </label>
                <input
                  id="status-reason"
                  className="mt-1 w-full rounded-xl border border-[#D9E0EA] px-3 py-2.5 text-sm"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <select
                className="rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
                value=""
                onChange={(event) => {
                  if (event.target.value) void updateStatus(event.target.value);
                }}
              >
                <option value="">Change status…</option>
                {STATUSES.filter((status) => status !== detail.status).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold">Status history</h4>
              <ul className="mt-2 space-y-2 text-xs text-[#667085]">
                {detail.statusHistory.map((entry) => (
                  <li key={entry.id}>
                    {entry.oldStatus ?? "—"} → <strong>{entry.newStatus}</strong> by {personName(entry.changedBy)}
                    {entry.reason ? ` — ${entry.reason}` : ""}
                  </li>
                ))}
                {detail.statusHistory.length === 0 ? <li>No status changes yet.</li> : null}
              </ul>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold">Notes</h4>
              <ul className="mt-2 space-y-2">
                {detail.notes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-[#E8ECF3] p-3 text-sm">
                    <p>{note.note}</p>
                    <p className="mt-1 text-[11px] text-[#9AA3B2]">
                      {personName(note.user)} · {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-[#D9E0EA] px-3 py-2.5 text-sm"
                  placeholder="Add a review note…"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void addNote()}
                  className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Add note
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D9E0EA] p-8 text-center text-sm text-[#828B9B]">
            Select a claim to review its details, change its status and add notes.
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Message = {
  id: string;
  senderType: string;
  body: string;
  readAt?: string | null;
};
type StudentProfile = {
  id: string;
  user?: { firstName?: string | null; lastName?: string | null };
  consultantAssignments?: { consultant: Consultant }[];
};
type Consultant = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};
type Row = {
  id: string;
  status: string;
  university?: { name: string };
  offering?: { name: string };
  scholarship?: { title: string };
  subject?: string;
  studentProfile?: StudentProfile;
  consultantAssignment?: { consultant: Consultant } | null;
  messages?: Message[];
};
type Referral = {
  id: string;
  stage: string;
  rewardStatus: string;
  rewardAmount: number | null;
  rewardCurrency: string | null;
  referrerProfile: {
    user: { firstName: string | null; lastName: string | null };
  };
  referredProfile: {
    user: { firstName: string | null; lastName: string | null };
  };
};
type Overview = {
  applications: Row[];
  scholarshipApplications: Row[];
  tickets: Row[];
  conversations: Row[];
  referrals: Referral[];
  consultants: Consultant[];
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await authFetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Unable to update student operations");
  return response.json() as Promise<T>;
}

function studentName(profile: StudentProfile | undefined) {
  const name = [profile?.user?.firstName, profile?.user?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || "Student";
}

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export function StudentOperationsManager() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    request<Overview>("/api/v1/admin/student-operations/overview")
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  useEffect(() => {
    void load();
  }, []);

  const update = async (path: string, body: Record<string, unknown>) => {
    try {
      setError("");
      await request(path, { method: "PATCH", body: JSON.stringify(body) });
      load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const uploadOffer = async (applicationId: string, file: File) => {
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await authFetch(
        `/api/v1/admin/student-operations/applications/${applicationId}/offer`,
        { method: "PATCH", body: form },
      );
      if (!response.ok) throw new Error("Unable to upload the offer letter");
      load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <section
      className="mx-auto max-w-7xl space-y-6 p-6"
      aria-labelledby="student-operations-heading"
    >
      <div>
        <h2 id="student-operations-heading" className="text-2xl font-semibold">
          Student operations
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage applications, adviser assignments, student conversations,
          referrals and support requests.
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      ) : null}
      {!data ? (
        <p>Loading…</p>
      ) : (
        <>
          <OperationsTable
            title="University applications"
            rows={data.applications}
            consultants={data.consultants}
            label={(row) =>
              row.offering?.name ?? row.university?.name ?? "Application"
            }
            statuses={["UNDER_REVIEW", "OFFER_RECEIVED", "REJECTED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/applications/${row.id}/status`,
                { status },
              )
            }
            onAssign={(profileId, consultantId) =>
              update(
                `/api/v1/admin/student-operations/students/${profileId}/consultant`,
                { consultantId },
              )
            }
            onOffer={(row, file) => void uploadOffer(row.id, file)}
          />
          <OperationsTable
            title="Scholarship applications"
            rows={data.scholarshipApplications}
            consultants={data.consultants}
            label={(row) => row.scholarship?.title ?? "Scholarship application"}
            statuses={["UNDER_REVIEW", "AWARDED", "REJECTED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/scholarship-applications/${row.id}/status`,
                { status },
              )
            }
            onAssign={(profileId, consultantId) =>
              update(
                `/api/v1/admin/student-operations/students/${profileId}/consultant`,
                { consultantId },
              )
            }
          />
          <ThreadPanel
            title="Student messages"
            rows={data.conversations}
            label={(row) =>
              `${studentName(row.studentProfile)}${row.consultantAssignment?.consultant ? ` · ${row.consultantAssignment.consultant.name}` : " · Unassigned"}`
            }
            actionLabel="Reply to student"
            onReply={(row, body) =>
              update(
                `/api/v1/admin/student-operations/conversations/${row.id}/reply`,
                { body },
              )
            }
          />
          <ThreadPanel
            title="Support tickets"
            rows={data.tickets}
            label={(row) =>
              `${row.subject ?? "Support request"} · ${studentName(row.studentProfile)}`
            }
            actionLabel="Reply to request"
            statuses={["IN_PROGRESS", "RESOLVED", "CLOSED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/support-tickets/${row.id}/status`,
                { status },
              )
            }
            onReply={(row, body) =>
              update(
                `/api/v1/admin/student-operations/support-tickets/${row.id}/reply`,
                { body },
              )
            }
          />
          <ReferralTable
            referrals={data.referrals}
            onMarkPaid={(id) =>
              update(
                `/api/v1/admin/student-operations/referrals/${id}/reward-status`,
                { rewardStatus: "PAID" },
              )
            }
          />
        </>
      )}
    </section>
  );
}

function OperationsTable({
  title,
  rows,
  consultants,
  label,
  statuses,
  onStatus,
  onAssign,
  onOffer,
}: {
  title: string;
  rows: Row[];
  consultants: Consultant[];
  label: (row: Row) => string;
  statuses: string[];
  onStatus: (row: Row, status: string) => void;
  onAssign: (profileId: string, consultantId: string) => void;
  onOffer?: (row: Row, file: File) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Record</th>
                <th className="p-2">Student</th>
                <th className="p-2">Consultant</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{label(row)}</td>
                  <td className="p-2">{studentName(row.studentProfile)}</td>
                  <td className="p-2">
                    <select
                      aria-label={`Assign consultant for ${label(row)}`}
                      value={
                        row.studentProfile?.consultantAssignments?.[0]
                          ?.consultant.id ?? ""
                      }
                      onChange={(event) => {
                        if (row.studentProfile && event.target.value)
                          onAssign(row.studentProfile.id, event.target.value);
                      }}
                    >
                      <option value="">Unassigned</option>
                      {consultants.map((consultant) => (
                        <option key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">{readable(row.status)}</td>
                  <td className="p-2">
                    <select
                      aria-label={`Change status for ${label(row)}`}
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value)
                          onStatus(row, event.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Change status
                      </option>
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {readable(status)}
                        </option>
                      ))}
                    </select>
                    {onOffer ? (
                      <label className="mt-2 block text-xs text-slate-600">
                        Upload offer{" "}
                        <input
                          className="block max-w-48"
                          type="file"
                          accept="application/pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onOffer(row, file);
                          }}
                        />
                      </label>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No records yet.</p>
      )}
    </section>
  );
}

function ThreadPanel({
  title,
  rows,
  label,
  actionLabel,
  statuses,
  onStatus,
  onReply,
}: {
  title: string;
  rows: Row[];
  label: (row: Row) => string;
  actionLabel: string;
  statuses?: string[];
  onStatus?: (row: Row, status: string) => void;
  onReply: (row: Row, body: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 space-y-4">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{label(row)}</h3>
                {statuses && onStatus ? (
                  <select
                    aria-label={`Change status for ${label(row)}`}
                    value={row.status}
                    onChange={(event) => onStatus(row, event.target.value)}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {readable(status)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {row.messages?.map((message) => (
                  <p key={message.id} className="rounded bg-slate-50 p-2">
                    <strong>
                      {message.senderType === "STUDENT" ? "Student" : "Admin"}:
                    </strong>{" "}
                    {message.body}
                  </p>
                ))}
              </div>
              {row.status !== "CLOSED" ? (
                <div className="mt-3">
                  <label className="sr-only" htmlFor={`reply-${row.id}`}>
                    {actionLabel}
                  </label>
                  <textarea
                    id={`reply-${row.id}`}
                    className="w-full rounded border border-slate-300 p-2"
                    value={drafts[row.id] ?? ""}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="mt-2 rounded bg-slate-900 px-3 py-2 text-sm text-white"
                    onClick={() => {
                      const body = drafts[row.id]?.trim();
                      if (body) {
                        onReply(row, body);
                        setDrafts((current) => ({ ...current, [row.id]: "" }));
                      }
                    }}
                  >
                    {actionLabel}
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Closed</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No records yet.</p>
      )}
    </section>
  );
}

function ReferralTable({
  referrals,
  onMarkPaid,
}: {
  referrals: Referral[];
  onMarkPaid: (id: string) => void;
}) {
  const name = (user: Referral["referrerProfile"]["user"]) =>
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Student";
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Referrals</h2>
      {referrals.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Referrer</th>
                <th className="p-2">Referred student</th>
                <th className="p-2">Stage</th>
                <th className="p-2">Reward</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((referral) => (
                <tr key={referral.id} className="border-b last:border-0">
                  <td className="p-2">{name(referral.referrerProfile.user)}</td>
                  <td className="p-2">{name(referral.referredProfile.user)}</td>
                  <td className="p-2">{readable(referral.stage)}</td>
                  <td className="p-2">
                    {referral.rewardAmount
                      ? `${referral.rewardCurrency ?? ""} ${referral.rewardAmount}`
                      : "Not eligible"}{" "}
                    · {readable(referral.rewardStatus)}
                  </td>
                  <td className="p-2">
                    {referral.rewardStatus === "ELIGIBLE" ? (
                      <button
                        className="rounded bg-slate-900 px-3 py-2 text-xs text-white"
                        onClick={() => onMarkPaid(referral.id)}
                      >
                        Mark paid
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No referrals yet.</p>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Row = {
  id: string;
  status: string;
  university?: { name: string };
  offering?: { name: string };
  scholarship?: { title: string };
  subject?: string;
  studentProfile?: { id: string; user?: { email: string } };
};
type Overview = {
  applications: Row[];
  scholarshipApplications: Row[];
  tickets: Row[];
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await authFetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error("Unable to update student operations");
  return response.json() as Promise<T>;
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
  const update = async (path: string, status: string) => {
    try {
      await request(path, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Student operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review applications and support requests. Student personal records are
          only shown where operationally necessary.
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
            label={(row) =>
              row.offering?.name ?? row.university?.name ?? "Application"
            }
            statuses={["UNDER_REVIEW", "OFFER_RECEIVED", "REJECTED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/applications/${row.id}/status`,
                status,
              )
            }
          />
          <OperationsTable
            title="Scholarship applications"
            rows={data.scholarshipApplications}
            label={(row) => row.scholarship?.title ?? "Scholarship application"}
            statuses={["UNDER_REVIEW", "AWARDED", "REJECTED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/scholarship-applications/${row.id}/status`,
                status,
              )
            }
          />
          <OperationsTable
            title="Support tickets"
            rows={data.tickets}
            label={(row) => row.subject ?? "Support request"}
            statuses={["IN_PROGRESS", "RESOLVED", "CLOSED"]}
            onStatus={(row, status) =>
              update(
                `/api/v1/admin/student-operations/support-tickets/${row.id}/status`,
                status,
              )
            }
          />
        </>
      )}
    </main>
  );
}
function OperationsTable({
  title,
  rows,
  label,
  statuses,
  onStatus,
}: {
  title: string;
  rows: Row[];
  label: (row: Row) => string;
  statuses: string[];
  onStatus: (row: Row, status: string) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Record</th>
                <th className="p-2">Student</th>
                <th className="p-2">Status</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{label(row)}</td>
                  <td className="p-2">
                    {row.studentProfile?.user?.email ?? "—"}
                  </td>
                  <td className="p-2">{row.status.replaceAll("_", " ")}</td>
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
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
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

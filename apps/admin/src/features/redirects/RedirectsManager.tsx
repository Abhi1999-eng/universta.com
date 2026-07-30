"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Redirect = {
  id: string;
  sourcePath: string;
  targetPath: string;
  httpStatusCode: number;
  isActive: boolean;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_CODES = [301, 302, 307, 308];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/redirects${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function StatusCodeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const fieldId = useId();
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={fieldId}>HTTP status</label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputClass}
      >
        {STATUS_CODES.map((code) => (
          <option value={code} key={code}>
            {code} {code === 301 ? "(permanent)" : code === 302 ? "(temporary)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [sourcePath, setSourcePath] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [httpStatusCode, setHttpStatusCode] = useState(301);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await api("", {
        method: "POST",
        body: JSON.stringify({ sourcePath, targetPath, httpStatusCode }),
      });
      setSourcePath("");
      setTargetPath("");
      setHttpStatusCode(301);
      setMessage("Redirect created.");
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create redirect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
      <h3 className="text-lg font-semibold">Create a redirect</h3>
      <p className="mt-1 text-xs text-[#828B9B]">
        Both paths must be internal (start with a single &quot;/&quot;) -- external
        URLs are rejected to prevent open redirects. A target that is itself
        the source of another active redirect is also rejected, so chains
        stay flat.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Source path" value={sourcePath} onChange={setSourcePath} />
        <Field label="Target path" value={targetPath} onChange={setTargetPath} />
        <StatusCodeSelect value={httpStatusCode} onChange={setHttpStatusCode} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !sourcePath || !targetPath}
          onClick={() => void submit()}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Create redirect
        </button>
        {message ? (
          <p className="text-sm text-[#48505F]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EditRow({
  redirect,
  onSaved,
  onCancel,
}: {
  redirect: Redirect;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [sourcePath, setSourcePath] = useState(redirect.sourcePath);
  const [targetPath, setTargetPath] = useState(redirect.targetPath);
  const [httpStatusCode, setHttpStatusCode] = useState(redirect.httpStatusCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(`/${redirect.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sourcePath, targetPath, httpStatusCode }),
      });
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save redirect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="bg-[#F7F9FC]">
      <td colSpan={6} className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Source path" value={sourcePath} onChange={setSourcePath} />
          <Field label="Target path" value={targetPath} onChange={setTargetPath} />
          <StatusCodeSelect value={httpStatusCode} onChange={setHttpStatusCode} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-lg bg-[#1657CF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#E8ECF3] px-3 py-2 text-xs font-semibold"
          >
            Cancel
          </button>
          {message ? (
            <p className="text-xs text-red-700" role="alert">
              {message}
            </p>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function RedirectsManager() {
  const [rows, setRows] = useState<Redirect[]>([]);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (activeFilter !== "all") params.set("isActive", activeFilter);
      const result = await api<Redirect[]>(`?${params.toString()}`);
      setRows(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load redirects");
    } finally {
      setLoading(false);
    }
  }, [q, activeFilter]);

  useEffect(() => {
    // Runs on mount and whenever the search/filter state changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggleActive(row: Redirect) {
    setMessage("");
    try {
      await api(`/${row.id}/${row.isActive ? "disable" : "enable"}`, {
        method: "POST",
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update redirect");
    }
  }

  async function archive(row: Redirect) {
    if (!window.confirm(`Permanently remove the redirect from ${row.sourcePath}?`)) return;
    setMessage("");
    try {
      await api(`/${row.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive redirect");
    }
  }

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          URL management
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Redirects</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Manage source-to-target URL redirects. Automatic redirects created
          when a resource&apos;s slug changes appear here too and can be
          edited or disabled the same way.
        </p>
      </div>

      <div className="mt-6 space-y-6">
      <CreateForm onCreated={load} />

      <div className="rounded-2xl border border-[#E8ECF3] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Redirects</h3>
          <div className="flex items-center gap-3">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search source or target path"
              className={`${inputClass} mt-0 w-64`}
            />
            <select
              value={activeFilter}
              onChange={(event) =>
                setActiveFilter(event.target.value as "all" | "true" | "false")
              }
              className={`${inputClass} mt-0`}
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>
        </div>

        {message ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-6 text-sm text-[#667085]">Loading redirects…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8ECF3] text-xs font-bold uppercase tracking-wide text-[#828B9B]">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Hits</th>
                  <th className="py-2 pr-3">State</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#828B9B]">
                      No redirects yet.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) =>
                  editingId === row.id ? (
                    <EditRow
                      key={row.id}
                      redirect={row}
                      onSaved={async () => {
                        setEditingId(null);
                        await load();
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={row.id} className="border-b border-[#F0F4FA]">
                      <td className="py-3 pr-3 font-mono text-xs">{row.sourcePath}</td>
                      <td className="py-3 pr-3 font-mono text-xs">{row.targetPath}</td>
                      <td className="py-3 pr-3">{row.httpStatusCode}</td>
                      <td className="py-3 pr-3">
                        {row.hitCount}
                        {row.lastHitAt ? (
                          <span className="ml-1 text-xs text-[#828B9B]">
                            (last {new Date(row.lastHitAt).toLocaleDateString()})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            row.isActive
                              ? "bg-[#EAF7EE] text-[#1A7F37]"
                              : "bg-[#F2F2F2] text-[#667085]"
                          }`}
                        >
                          {row.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(row.id)}
                            className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(row)}
                            className="rounded-lg border border-[#E8ECF3] px-2 py-1 text-xs font-semibold"
                          >
                            {row.isActive ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void archive(row)}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type ResourceMeta = {
  key: string;
  label: string;
  columns: string[];
  requiredColumns: string[];
  updatableColumns: string[];
};
type RowError = { line: number; errors: string[] };
type ImportSummary = { totalRows: number; created: number; updated: number; failed: number; errors: RowError[] };
type RecordRow = { id: string } & Record<string, unknown>;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/bulk${path}`, init);
  const body = (await response.json()) as { data?: T; error?: { message?: string } | null };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

async function downloadFile(path: string, filename: string) {
  const response = await authFetch(`/api/v1/admin/bulk${path}`);
  if (!response.ok) throw new Error("Unable to download file");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const buttonClass = "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const secondaryButtonClass = "rounded-xl border border-[#D9E0EA] px-4 py-2.5 text-sm font-semibold text-[#48505F] disabled:opacity-60";

export function BulkDataManager() {
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [message, setMessage] = useState("");
  const [dryRunResult, setDryRunResult] = useState<{ totalRows: number; errors: RowError[] } | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [updateField, setUpdateField] = useState("");
  const [updateValue, setUpdateValue] = useState("");

  useEffect(() => {
    void api<ResourceMeta[]>("/resources")
      .then((rows) => {
        setResources(rows);
        if (rows.length) setSelectedKey(rows[0].key);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load resources"));
  }, []);

  const selected = resources.find((resource) => resource.key === selectedKey) ?? null;

  const loadRecords = useCallback(async (key: string) => {
    if (!key) return;
    try {
      setRecords(await api<RecordRow[]>(`/${key}/records`));
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load records");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords(selectedKey);
    setDryRunResult(null);
    setImportResult(null);
    setUpdateField("");
  }, [selectedKey, loadRecords]);

  async function runDryRun() {
    const file = fileRef.current?.files?.[0];
    if (!file || !selectedKey) {
      setMessage("Choose a file first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setDryRunResult(await api(`/${selectedKey}/dry-run`, { method: "POST", body: form }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dry run failed");
    } finally {
      setBusy(false);
    }
  }

  async function runImport(mode: "create" | "upsert") {
    const file = fileRef.current?.files?.[0];
    if (!file || !selectedKey) {
      setMessage("Choose a file first.");
      return;
    }
    setBusy(true);
    setMessage("");
    setDryRunResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const result = await api<ImportSummary>(`/${selectedKey}/import`, { method: "POST", body: form });
      setImportResult(result);
      await loadRecords(selectedKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkUpdate() {
    if (!selectedKey || selectedIds.size === 0 || !updateField) {
      setMessage("Select at least one record and a field to update.");
      return;
    }
    try {
      await api(`/${selectedKey}/bulk-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], fields: { [updateField]: updateValue } }),
      });
      setMessage("Bulk update applied.");
      await loadRecords(selectedKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk update failed");
    }
  }

  async function applyBulkArchive() {
    if (!selectedKey || selectedIds.size === 0) {
      setMessage("Select at least one record to archive.");
      return;
    }
    try {
      const result = await api<{ archived: number; blocked: { id: string; reason: string }[] }>(
        `/${selectedKey}/bulk-archive`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: [...selectedIds] }),
        },
      );
      setMessage(
        result.blocked.length
          ? `Archived ${result.archived}; ${result.blocked.length} blocked (${result.blocked.map((b) => b.reason).join("; ")})`
          : `Archived ${result.archived} record(s).`,
      );
      await loadRecords(selectedKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk archive failed");
    }
  }

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Catalog operations</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Bulk data import &amp; export</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Import and export catalog records via CSV/XLSX, with dry-run validation, and bulk-update or
          archive selected records. Currently covers Countries, States, Cities, Subjects, Generic
          Courses, Careers and Events.
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm font-semibold" htmlFor="bulk-resource">
          Resource
        </label>
        <select
          id="bulk-resource"
          className="rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm"
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value)}
        >
          {resources.map((resource) => (
            <option key={resource.key} value={resource.key}>
              {resource.label}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      {selected ? (
        <>
          <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <h3 className="text-sm font-semibold">Template &amp; export</h3>
            <p className="mt-1 text-xs text-[#828B9B]">
              Required columns: {selected.requiredColumns.join(", ")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void downloadFile(`/${selected.key}/template?format=csv`, `${selected.key}-template.csv`)}
              >
                Download CSV template
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void downloadFile(`/${selected.key}/template?format=xlsx`, `${selected.key}-template.xlsx`)}
              >
                Download XLSX template
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void downloadFile(`/${selected.key}/export?format=csv`, `${selected.key}-export.csv`)}
              >
                Export CSV
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void downloadFile(`/${selected.key}/export?format=xlsx`, `${selected.key}-export.xlsx`)}
              >
                Export XLSX
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <h3 className="text-sm font-semibold">Import</h3>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="mt-3 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => void runDryRun()}>
                {busy ? "Working…" : "Dry run (validate only)"}
              </button>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => void runImport("create")}>
                Import (create only)
              </button>
              <button type="button" disabled={busy} className={buttonClass} onClick={() => void runImport("upsert")}>
                Import (create or update)
              </button>
            </div>

            {dryRunResult ? (
              <div className="mt-4 rounded-xl bg-[#F7F9FC] p-4 text-sm">
                <p>
                  {dryRunResult.totalRows} row(s) checked, {dryRunResult.errors.length} with errors.
                </p>
                {dryRunResult.errors.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-red-700">
                    {dryRunResult.errors.map((error) => (
                      <li key={error.line}>
                        Line {error.line}: {error.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[#18794E]">No errors found — ready to import.</p>
                )}
              </div>
            ) : null}

            {importResult ? (
              <div className="mt-4 rounded-xl bg-[#F7F9FC] p-4 text-sm">
                <p>
                  {importResult.created} created, {importResult.updated} updated, {importResult.failed} failed
                  (of {importResult.totalRows} rows).
                </p>
                {importResult.errors.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-red-700">
                    {importResult.errors.map((error) => (
                      <li key={error.line}>
                        Line {error.line}: {error.errors.join("; ")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <h3 className="text-sm font-semibold">Manage existing records</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-semibold" htmlFor="update-field">
                  Field to bulk-update
                </label>
                <select
                  id="update-field"
                  className="mt-1 rounded-xl border border-[#D9E0EA] bg-white px-3 py-2 text-sm"
                  value={updateField}
                  onChange={(event) => setUpdateField(event.target.value)}
                >
                  <option value="">Select a field…</option>
                  {selected.updatableColumns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold" htmlFor="update-value">
                  New value
                </label>
                <input
                  id="update-value"
                  className="mt-1 rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
                  value={updateValue}
                  onChange={(event) => setUpdateValue(event.target.value)}
                />
              </div>
              <button type="button" className={buttonClass} onClick={() => void applyBulkUpdate()}>
                Apply to selected ({selectedIds.size})
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700"
                onClick={() => void applyBulkArchive()}
              >
                Archive selected ({selectedIds.size})
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-[#E8ECF3]">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F9FC] text-left text-xs font-semibold uppercase tracking-[0.08em] text-[#828B9B]">
                  <tr>
                    <th className="px-3 py-2" />
                    {selected.columns.slice(0, 4).map((column) => (
                      <th className="px-3 py-2" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row.id} className="border-t border-[#E8ECF3]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          aria-label={`Select ${String(row.slug ?? row.id)}`}
                        />
                      </td>
                      {selected.columns.slice(0, 4).map((column) => (
                        <td className="px-3 py-2" key={column}>
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 ? <p className="p-4 text-sm text-[#667085]">No records yet.</p> : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

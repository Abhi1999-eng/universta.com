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
type DryRunResult = { totalRows: number; errors: RowError[] };
type ImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: RowError[];
};
type RecordRow = { id: string } & Record<string, unknown>;

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string } | null;
};

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const buttonClass =
  "rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-xl border border-[#D9E0EA] bg-white px-4 py-2.5 text-sm font-semibold text-[#48505F] disabled:cursor-not-allowed disabled:opacity-50";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/bulk${path}`, init);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Request failed");
  }
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function localFileError(file: File): string | null {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    return "Only CSV (.csv) and Excel (.xlsx) files are supported.";
  }
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The selected file exceeds the 3 MB limit.";
  return null;
}

function RowErrors({
  title,
  errors,
  description,
}: {
  title: string;
  errors: RowError[];
  description: string;
}) {
  if (!errors.length) return null;
  return (
    <div
      className="mt-4 rounded-xl border border-[#F3B8B8] bg-[#FFF6F6] p-4 text-sm text-[#8F1D1D]"
      role="alert"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5">{description}</p>
      <div className="mt-3 grid gap-2">
        {errors.map((error) => (
          <div
            key={`${error.line}-${error.errors.join("-")}`}
            className="rounded-lg border border-[#F6D2D2] bg-white px-3 py-2"
          >
            <p className="font-semibold">Row {error.line}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
              {error.errors.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BulkDataManager() {
  const [resources, setResources] = useState<ResourceMeta[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [notice, setNotice] = useState("");
  const [requestError, setRequestError] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      .catch((error) =>
        setRequestError(
          error instanceof Error ? error.message : "Unable to load resources",
        ),
      );
  }, []);

  const selected =
    resources.find((resource) => resource.key === selectedKey) ?? null;

  const loadRecords = useCallback(async (key: string) => {
    if (!key) return;
    try {
      setRecords(await api<RecordRow[]>(`/${key}/records`));
      setSelectedIds(new Set());
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Unable to load records",
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRecords(selectedKey);
  }, [selectedKey, loadRecords]);

  function resetImportState() {
    setSelectedFile(null);
    setDryRunResult(null);
    setImportResult(null);
    setNotice("");
    setRequestError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function changeResource(key: string) {
    setSelectedKey(key);
    setUpdateField("");
    setUpdateValue("");
    resetImportState();
  }

  async function validateFile(file: File): Promise<DryRunResult | null> {
    const localError = localFileError(file);
    if (localError) {
      setDryRunResult(null);
      setRequestError(localError);
      return null;
    }
    if (!selectedKey) return null;

    setBusy(true);
    setNotice("");
    setRequestError("");
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api<DryRunResult>(`/${selectedKey}/dry-run`, {
        method: "POST",
        body: form,
      });
      setDryRunResult(result);
      if (result.errors.length === 0) {
        setNotice(
          `${result.totalRows} row(s) validated successfully. File is ready to import.`,
        );
      }
      return result;
    } catch (error) {
      setDryRunResult(null);
      setRequestError(
        error instanceof Error ? error.message : "File validation failed",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setDryRunResult(null);
    setImportResult(null);
    setNotice("");
    setRequestError("");
    if (file) await validateFile(file);
  }

  async function runDryRun() {
    if (!selectedFile) {
      setRequestError("Choose a CSV or XLSX file from your device first.");
      return;
    }
    await validateFile(selectedFile);
  }

  async function runImport(mode: "create" | "upsert") {
    if (!selectedFile || !selectedKey) {
      setRequestError("Choose a CSV or XLSX file from your device first.");
      return;
    }

    const validation = await validateFile(selectedFile);
    if (!validation || validation.errors.length > 0) return;

    setBusy(true);
    setNotice("");
    setRequestError("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("mode", mode);
      const result = await api<ImportSummary>(`/${selectedKey}/import`, {
        method: "POST",
        body: form,
      });
      setImportResult(result);
      if (result.errors.length === 0) {
        setNotice(
          `Import complete: ${result.created} created and ${result.updated} updated in the database.`,
        );
      }
      await loadRecords(selectedKey);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Import failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(path: string, filename: string) {
    setRequestError("");
    try {
      await downloadFile(path, filename);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Download failed",
      );
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
      setRequestError("Select at least one record and a field to update.");
      return;
    }
    setRequestError("");
    try {
      await api(`/${selectedKey}/bulk-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: [...selectedIds],
          fields: { [updateField]: updateValue },
        }),
      });
      setNotice("Bulk update applied.");
      await loadRecords(selectedKey);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Bulk update failed",
      );
    }
  }

  async function applyBulkArchive() {
    if (!selectedKey || selectedIds.size === 0) {
      setRequestError("Select at least one record to archive.");
      return;
    }
    setRequestError("");
    try {
      const result = await api<{
        archived: number;
        blocked: { id: string; reason: string }[];
      }>(`/${selectedKey}/bulk-archive`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      setNotice(
        result.blocked.length
          ? `Archived ${result.archived}; ${result.blocked.length} blocked (${result.blocked.map((entry) => entry.reason).join("; ")})`
          : `Archived ${result.archived} record(s).`,
      );
      await loadRecords(selectedKey);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Bulk archive failed",
      );
    }
  }

  const hasValidationErrors = Boolean(dryRunResult?.errors.length);
  const canImport = Boolean(
    selectedFile && dryRunResult && !hasValidationErrors && !busy,
  );

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
          Catalog operations
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Bulk data import &amp; export
        </h2>
        <p className="mt-2 text-sm text-[#667085]">
          Choose a catalog resource, upload its CSV/XLSX file from your device,
          validate every row, then write valid data to the database.
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
          onChange={(event) => changeResource(event.target.value)}
        >
          {resources.map((resource) => (
            <option key={resource.key} value={resource.key}>
              {resource.label}
            </option>
          ))}
        </select>
      </div>

      {requestError ? (
        <div
          className="mt-4 rounded-xl border border-[#F3B8B8] bg-[#FFF6F6] px-4 py-3 text-sm text-[#8F1D1D]"
          role="alert"
        >
          <p className="font-semibold">Action could not be completed</p>
          <p className="mt-1">{requestError}</p>
        </div>
      ) : null}

      {notice ? (
        <div
          className="mt-4 rounded-xl border border-[#B7E4C8] bg-[#F1FBF5] px-4 py-3 text-sm text-[#18794E]"
          role="status"
        >
          {notice}
        </div>
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
                onClick={() =>
                  void handleDownload(
                    `/${selected.key}/template?format=csv`,
                    `${selected.key}-template.csv`,
                  )
                }
              >
                Download CSV template
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  void handleDownload(
                    `/${selected.key}/template?format=xlsx`,
                    `${selected.key}-template.xlsx`,
                  )
                }
              >
                Download XLSX template
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  void handleDownload(
                    `/${selected.key}/export?format=csv`,
                    `${selected.key}-export.csv`,
                  )
                }
              >
                Export CSV
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  void handleDownload(
                    `/${selected.key}/export?format=xlsx`,
                    `${selected.key}-export.xlsx`,
                  )
                }
              >
                Export XLSX
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#E8ECF3] bg-white p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-sm font-semibold">Import from device</h3>
                <p className="mt-1 text-xs leading-5 text-[#667085]">
                  Select a CSV/XLSX file. Universta validates it immediately and
                  shows the exact row errors before import.
                </p>
              </div>
              <span className="rounded-full bg-[#F7F9FC] px-3 py-1.5 text-xs font-semibold text-[#667085]">
                Max 3 MB · Max 2,000 rows
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              onChange={(event) => void onFileSelected(event)}
            />

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-[#BFCBE0] bg-[#FAFBFD] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#334155]">
                  {selectedFile ? selectedFile.name : "No file selected"}
                </p>
                <p className="mt-1 text-xs text-[#828B9B]">
                  {selectedFile
                    ? `${formatBytes(selectedFile.size)} · ${selectedFile.name.toLowerCase().endsWith(".xlsx") ? "Excel workbook" : "CSV file"}`
                    : "Choose a file stored on this device."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {selectedFile ? "Change file" : "Choose file from device"}
                </button>
                {selectedFile ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={resetImportState}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !selectedFile}
                className={secondaryButtonClass}
                onClick={() => void runDryRun()}
              >
                {busy ? "Validating…" : "Validate again"}
              </button>
              <button
                type="button"
                disabled={!canImport}
                className={buttonClass}
                onClick={() => void runImport("create")}
              >
                {busy ? "Working…" : "Import new records"}
              </button>
              <button
                type="button"
                disabled={!canImport}
                className={buttonClass}
                onClick={() => void runImport("upsert")}
              >
                {busy ? "Working…" : "Import & update existing"}
              </button>
            </div>

            {selectedFile && !busy && !dryRunResult && !requestError ? (
              <p className="mt-3 text-xs text-[#667085]">
                Waiting for validation before import is enabled.
              </p>
            ) : null}

            {dryRunResult ? (
              <div className="mt-4">
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    dryRunResult.errors.length
                      ? "border-[#F3B8B8] bg-[#FFF6F6] text-[#8F1D1D]"
                      : "border-[#B7E4C8] bg-[#F1FBF5] text-[#18794E]"
                  }`}
                >
                  <p className="font-semibold">
                    {dryRunResult.errors.length
                      ? `Validation failed for ${dryRunResult.errors.length} row(s)`
                      : "Validation passed"}
                  </p>
                  <p className="mt-1 text-xs">
                    {dryRunResult.totalRows} row(s) checked.
                    {dryRunResult.errors.length
                      ? " Fix the rows below and upload the corrected file. Nothing is imported while validation has errors."
                      : " All rows are structurally valid and import buttons are enabled."}
                  </p>
                </div>
                <RowErrors
                  title="Rows that need correction"
                  errors={dryRunResult.errors}
                  description="Each error below identifies the spreadsheet row and the exact field/value problem reported by the selected resource validator."
                />
              </div>
            ) : null}

            {importResult ? (
              <div className="mt-4">
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    importResult.errors.length
                      ? "border-[#F3B8B8] bg-[#FFF6F6] text-[#8F1D1D]"
                      : "border-[#B7E4C8] bg-[#F1FBF5] text-[#18794E]"
                  }`}
                >
                  <p className="font-semibold">
                    {importResult.errors.length
                      ? "Import completed with row errors"
                      : "Database import completed"}
                  </p>
                  <p className="mt-1 text-xs">
                    {importResult.created} created · {importResult.updated} updated · {importResult.failed} failed · {importResult.totalRows} total
                  </p>
                </div>
                <RowErrors
                  title="Rows not imported"
                  errors={importResult.errors}
                  description="These rows were rejected by the database/import rules. Correct them and upload the file again."
                />
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
              <button
                type="button"
                className={buttonClass}
                onClick={() => void applyBulkUpdate()}
              >
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
              {records.length === 0 ? (
                <p className="p-4 text-sm text-[#667085]">No records yet.</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

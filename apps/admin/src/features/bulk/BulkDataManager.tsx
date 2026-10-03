"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type ResourceMeta = {
  key: string;
  label: string;
  columns: string[];
  requiredColumns: string[];
  updatableColumns: string[];
  fields?: { key: string; label: string; required: boolean; description?: string }[];
};
type RowError = { line: number; errors: string[] };
type DryRunResult = { totalRows: number; errors: RowError[] };
type ImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  /** Rows whose record already matched the sheet, so nothing was written. */
  unchanged: number;
  failed: number;
  errors: RowError[];
};
type RecordRow = { id: string } & Record<string, unknown>;
type RecordTableField = { key: string; label: string };

type ApiEnvelope<T> = {
  data?: T;
  error?: { message?: string } | null;
};

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/* What one bulk-archive request accepts. A larger selection is sent as
   several, from here, rather than the server growing a way to empty a whole
   table on one call. */
const ARCHIVE_BATCH = 2000;
const buttonClass =
  "p-btn p-btn--primary";
const secondaryButtonClass =
  "p-btn p-btn--ghost";

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

function recordTableFields(selected: ResourceMeta): RecordTableField[] {
  if (selected.fields) return selected.fields.slice(0, 4);
  return selected.columns
    .slice(0, 4)
    .map((column) => ({ key: column, label: column }));
}

function recordTableValue(field: RecordTableField, row: RecordRow): string {
  const value = row[field.key];
  if (value === null || value === undefined) return "";

  // Record listings retain the import contract's relation slugs. Present
  // those values as readable names without changing the API payload.
  if (
    field.key.endsWith("Slug") &&
    typeof value === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  ) {
    return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).replaceAll("-", " ");
  }

  return String(value);
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
  /** Holds the resource key an operator has typed to unlock "archive all". */
  const [confirmAll, setConfirmAll] = useState("");
  /** Typed to unlock the two that remove rows rather than mark them. */
  const [confirmDelete, setConfirmDelete] = useState("");
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
  const visibleRecordFields = selected ? recordTableFields(selected) : [];

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
    /* A different resource is a different table. The ticked ids belong to
       the one being left -- sending them under the new resource's name is
       the kind of mistake only noticed afterwards -- and both
       confirmations were typed about it, so a phrase that armed
       "delete countries" must not still be in the box when the screen has
       moved on to subjects. */
    setSelectedIds(new Set());
    setConfirmAll("");
    setConfirmDelete("");
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
          `Import complete: ${[
            `${result.created} created`,
            `${result.updated} updated`,
            // Only worth a mention when a row was actually left alone.
            ...(result.unchanged
              ? [`${result.unchanged} already up to date`]
              : []),
          ].join(", ")}.`,
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

  const allSelected =
    records.length > 0 && selectedIds.size === records.length;

  /** The header box: everything, or nothing. */
  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(records.map((row) => String(row.id))),
    );
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

  /**
   * Archives a selection of any size, or the whole resource.
   *
   * A ticked selection is sent in batches, because one request accepts at
   * most {@link ARCHIVE_BATCH} ids. "Everything" is not a selection at all:
   * the server is told `all` and reads the ids itself, which is the only
   * way to say it once a resource runs to thousands of rows.
   */
  async function archiveIds(ids: string[] | "all") {
    setRequestError("");
    setBusy(true);
    let archived = 0;
    const blocked: { id: string; reason: string }[] = [];
    const send = (body: Record<string, unknown>) =>
      api<{ archived: number; blocked: { id: string; reason: string }[] }>(
        `/${selectedKey}/bulk-archive`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    try {
      if (ids === "all") {
        setNotice(`Archiving every ${selectedKey} record…`);
        const result = await send({ all: true });
        archived = result.archived;
        blocked.push(...result.blocked);
      } else
        for (let from = 0; from < ids.length; from += ARCHIVE_BATCH) {
          const batch = ids.slice(from, from + ARCHIVE_BATCH);
          if (ids.length > ARCHIVE_BATCH)
            setNotice(
              `Archiving ${from + 1}–${Math.min(from + batch.length, ids.length)} of ${ids.length}…`,
            );
          const result = await send({ ids: batch });
          archived += result.archived;
          blocked.push(...result.blocked);
        }
      const reasons = [...new Set(blocked.map((entry) => entry.reason))];
      setNotice(
        blocked.length
          ? `Archived ${archived}; ${blocked.length} blocked (${reasons.join("; ")})`
          : `Archived ${archived} record(s).`,
      );
      setSelectedIds(new Set());
      setConfirmAll("");
      await loadRecords(selectedKey);
    } catch (error) {
      setRequestError(
        `${error instanceof Error ? error.message : "Bulk archive failed"}${
          archived ? ` (${archived} archived before this)` : ""
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Removes records outright. Archiving marks them deleted and the rows
   * stay; this is the other thing, and the server says so plainly when a
   * record is still referenced rather than taking the reference with it.
   */
  async function purge(
    body: { ids?: string[]; all?: boolean; emptyArchive?: boolean },
    what: string,
  ) {
    setRequestError("");
    setBusy(true);
    try {
      const result = await api<{
        deleted: number;
        blocked: { id: string; reason: string }[];
      }>(`/${selectedKey}/bulk-delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const reasons = [...new Set(result.blocked.map((row) => row.reason))];
      setNotice(
        result.blocked.length
          ? `Deleted ${result.deleted} ${what}; ${result.blocked.length} could not go (${reasons.join("; ")})`
          : `Deleted ${result.deleted} ${what}.`,
      );
      setSelectedIds(new Set());
      setConfirmAll("");
      setConfirmDelete("");
      await loadRecords(selectedKey);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Delete failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkArchive() {
    if (!selectedKey || selectedIds.size === 0) {
      setRequestError("Select at least one record to archive.");
      return;
    }
    await archiveIds([...selectedIds]);
  }

  /**
   * Archiving every live record of a resource.
   *
   * Behind a typed confirmation rather than a dialog, because this is the
   * one action on the page a mis-click cannot be taken back from in the
   * UI -- the rows are soft-deleted and restoring them is not something
   * this screen offers.
   */
  async function archiveEverything() {
    if (!selectedKey || records.length === 0) return;
    if (confirmAll.trim() !== selectedKey) {
      setRequestError(`Type ${selectedKey} to confirm archiving all of them.`);
      return;
    }
    await archiveIds("all");
  }

  const hasValidationErrors = Boolean(dryRunResult?.errors.length);
  const canImport = Boolean(
    selectedFile && dryRunResult && !hasValidationErrors && !busy,
  );

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="p-eyebrow">
          Catalog operations
        </p>
        <h2 className="p-h1">
          Bulk data import &amp; export
        </h2>
        <p className="p-sub">
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
          className="p-input p-input--sm"
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
          <div className="p-panel">
            <h3 className="text-sm font-semibold">Template &amp; export</h3>
            <p className="p-hint">
              Required: {selected.requiredColumns.join(", ")}. Templates use readable names, generate slugs automatically, and never require database IDs.
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

          <div className="p-panel">
            <div className="p-head">
              <div>
                <h3 className="text-sm font-semibold">Import from device</h3>
                <p className="p-hint">
                  Select a CSV/XLSX file. Universta validates it immediately and
                  shows the exact row errors before import.
                </p>
              </div>
              <span className="p-badge">
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

            <div className="p-drop">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#334155]">
                  {selectedFile ? selectedFile.name : "No file selected"}
                </p>
                <p className="p-hint">
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
              <p className="mt-3 p-hint">
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
                    {importResult.created} created · {importResult.updated} updated · {importResult.unchanged} unchanged · {importResult.failed} failed · {importResult.totalRows} total
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

          <div className="p-panel">
            <h3 className="text-sm font-semibold">Manage existing records</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-semibold" htmlFor="update-field">
                  Field to bulk-update
                </label>
                <select
                  id="update-field"
                  className="p-input"
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
                className="p-btn p-btn--danger"
                disabled={busy || selectedIds.size === 0}
                onClick={() => void applyBulkArchive()}
              >
                Archive selected ({selectedIds.size})
              </button>
            </div>

            {/* Everything, which is a different question from a selection and
                is asked differently: the resource's own name, typed. */}
            {records.length ? (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#F0C9C9] bg-[#FDF6F6] p-3">
                <div>
                  <label className="text-sm font-semibold" htmlFor="confirm-all">
                    Archive every {selectedKey} record ({records.length})
                  </label>
                  <p className="p-sub mt-1">
                    Type <code>{selectedKey}</code> to confirm. They are
                    soft-deleted, and this screen offers no way back.
                  </p>
                </div>
                <input
                  id="confirm-all"
                  className="rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
                  value={confirmAll}
                  /* Not the phrase itself. A box whose placeholder is the
                     thing you have to type looks already filled in, and the
                     button beside it looks broken rather than locked. */
                  placeholder="Type to confirm"
                  autoComplete="off"
                  onChange={(event) => setConfirmAll(event.target.value)}
                />
                <button
                  type="button"
                  className="p-btn p-btn--danger"
                  disabled={busy || confirmAll.trim() !== selectedKey}
                  onClick={() => void archiveEverything()}
                >
                  Archive all {records.length}
                </button>
              </div>
            ) : null}

            {/* Removing rows rather than marking them. Its own confirmation,
                because archiving is reversible in the database and this is
                not -- and because an operator who meant to archive should
                not reach this by typing the same thing twice. */}
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[#E4B9B9] bg-[#FBF0F0] p-3">
              <div>
                <label className="text-sm font-semibold" htmlFor="confirm-delete">
                  Delete permanently
                </label>
                <p className="p-sub mt-1">
                  The rows go, rather than being marked deleted. Type{" "}
                  <code>delete {selectedKey}</code> to confirm. Anything still
                  referenced by another record is reported and left alone.
                </p>
              </div>
              <input
                id="confirm-delete"
                className="rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm"
                value={confirmDelete}
                placeholder="Type to confirm"
                autoComplete="off"
                onChange={(event) => setConfirmDelete(event.target.value)}
              />
              <button
                type="button"
                className="p-btn p-btn--danger"
                disabled={
                  busy ||
                  selectedIds.size === 0 ||
                  confirmDelete.trim() !== `delete ${selectedKey}`
                }
                onClick={() =>
                  void purge({ ids: [...selectedIds] }, "record(s)")
                }
              >
                Delete selected ({selectedIds.size})
              </button>
              {/* Not offered at nothing: "Delete all 0" is a button that
                  cannot do anything. Emptying the archive still can, which
                  is exactly what a resource with no live rows is for. */}
              {records.length ? (
                <button
                  type="button"
                  className="p-btn p-btn--danger"
                  disabled={
                    busy || confirmDelete.trim() !== `delete ${selectedKey}`
                  }
                  onClick={() => void purge({ all: true }, "record(s)")}
                >
                  Delete all {records.length}
                </button>
              ) : null}
              <button
                type="button"
                className="p-btn"
                disabled={busy || confirmDelete.trim() !== `delete ${selectedKey}`}
                onClick={() =>
                  void purge({ emptyArchive: true }, "archived record(s)")
                }
              >
                Empty archive
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-[#E8ECF3]">
              <table className="p-table u-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label={
                          allSelected
                            ? "Clear selection"
                            : `Select all ${records.length}`
                        }
                      />
                    </th>
                    {visibleRecordFields.map((field) => (
                      <th key={field.key}>
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((row) => (
                    <tr key={row.id} className="border-t border-[#E8ECF3]">
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          aria-label={`Select ${String(row.slug ?? row.id)}`}
                        />
                      </td>
                      {visibleRecordFields.map((field) => (
                        <td key={field.key}>
                          {recordTableValue(field, row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.length === 0 ? (
                <p className="p-4 p-sub">No records yet.</p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

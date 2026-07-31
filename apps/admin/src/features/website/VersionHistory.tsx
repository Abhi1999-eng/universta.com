"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

/** Version history, comparison and restore for a Website Builder resource.
 *
 * The list is newest-first, every row says in words what changed and who
 * changed it, and comparison renders a field-by-field table rather than two
 * blobs of JSON -- an admin should never have to read a snapshot to decide
 * whether to roll back. Restore always asks first, and the confirmation states
 * the two things people get wrong about restore: it does not publish anything,
 * and it does not delete the versions after the one being restored. */

export type VersionResource =
  | "PAGE"
  | "PAGE_SECTION"
  | "PAGE_TEMPLATE"
  | "GLOBAL_HEADER"
  | "GLOBAL_FOOTER";

type VersionRow = {
  id: string;
  versionNumber: number;
  changeSummary: string;
  sourceAction: string;
  restoredFromVersion: number | null;
  createdAt: string;
  createdBy: { id: string; name: string; email: string } | null;
};

type Change = { field: string; from: unknown; to: unknown };

/** Renders a stored value as something readable. Objects are summarised by
 * their keys rather than dumped, so the compare table stays a table. */
function readable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "— empty —";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > 160 ? `${value.slice(0, 160)}…` : value;
  if (Array.isArray(value)) {
    // Name the items rather than counting them: a row is only shown when the
    // two sides differ, and "2 items" vs "2 items" tells the reader nothing.
    const named = value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          for (const key of ["heading", "title", "label", "name", "sectionKey", "settingKey"]) {
            if (typeof record[key] === "string" && record[key]) return record[key] as string;
          }
        }
        return null;
      })
      .filter(Boolean) as string[];
    if (!named.length) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    const shown = named.slice(0, 4).join(" · ");
    return named.length > 4 ? `${shown} · +${named.length - 4} more` : shown;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return entries
    .slice(0, 4)
    .map(([key, inner]) =>
      typeof inner === "object" && inner !== null ? key : `${key}: ${readable(inner)}`,
    )
    .join(", ");
}

const FIELD_LABELS: Record<string, string> = {
  bodyJson: "Body content",
  configurationJson: "Section settings (incl. device visibility)",
  ctaPrimaryLabel: "Primary button label",
  ctaPrimaryUrl: "Primary button link",
  ctaSecondaryLabel: "Secondary button label",
  ctaSecondaryUrl: "Secondary button link",
  defaultSectionsJson: "Default sections",
  displayOrder: "Position",
  layoutConfigJson: "Layout settings",
  mediaId: "Image",
  pageFamily: "Page family",
  pageType: "Page type",
  sectionKey: "Section key",
  sectionType: "Section type",
  settings: "Settings values",
  shortDescription: "Short description",
  shortTitle: "Short title",
};
const label = (field: string) =>
  FIELD_LABELS[field] ??
  field.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

export function VersionHistory({
  resourceType,
  resourceId,
  title,
  onRestored,
}: {
  resourceType: VersionResource;
  resourceId: string;
  title: string;
  onRestored?: () => void;
}) {
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [reload, setReload] = useState(0);

  const base = `/api/v1/admin/content-versions/${resourceType}/${encodeURIComponent(resourceId)}`;

  useEffect(() => {
    let cancelled = false;
    // Every state update happens after the request resolves, so nothing is
    // set synchronously in the effect body.
    void (async () => {
      try {
        const response = await authFetch(base, { cache: "no-store" });
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok || body?.error) throw new Error(body?.error?.message ?? "Could not load history.");
        setRows((body.data ?? []) as VersionRow[]);
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, reload]);

  const compare = useCallback(
    async (from: number, to: number) => {
      setChanges(null);
      setCompareTo(from);
      const response = await authFetch(`${base}/compare?from=${from}&to=${to}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || body?.error) {
        setError(body?.error?.message ?? "Could not compare these versions.");
        return;
      }
      setChanges((body.data?.changes ?? []) as Change[]);
    },
    [base],
  );

  const restore = useCallback(
    async (versionNumber: number) => {
      setConfirming(null);
      const response = await authFetch(`${base}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionNumber }),
      });
      const body = await response.json();
      if (!response.ok || body?.error) {
        setError(body?.error?.message ?? "Could not restore that version.");
        return;
      }
      setNotice(
        `Restored version ${versionNumber}. Saved as version ${body.data?.newVersion ?? "?"} — nothing was published and no earlier versions were removed.`,
      );
      setChanges(null);
      setReload((value) => value + 1);
      onRestored?.();
    },
    [base, onRestored],
  );

  const latest = rows[0]?.versionNumber ?? null;

  return (
    <section className="wb-history" aria-label={`Version history for ${title}`}>
      <header className="wb-history-head">
        <h3>Version history</h3>
        <p>
          Every saved change to <strong>{title}</strong>, newest first. Restoring writes an older
          state back and saves it as a new version; it never publishes and never deletes later
          versions.
        </p>
      </header>

      {error ? (
        <p className="wb-history-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="wb-history-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? <p className="wb-history-empty">Loading history…</p> : null}
      {!loading && !rows.length ? (
        <p className="wb-history-empty">
          No versions yet. The first version is saved the next time this item is edited.
        </p>
      ) : null}

      {rows.length ? (
        <ol className="wb-history-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="wb-history-row">
                <div>
                  <p className="wb-history-summary">
                    <span className="wb-history-version">v{row.versionNumber}</span>
                    {row.changeSummary}
                    {row.restoredFromVersion ? (
                      <span className="wb-history-badge">restored from v{row.restoredFromVersion}</span>
                    ) : null}
                  </p>
                  <p className="wb-history-meta">
                    {new Date(row.createdAt).toLocaleString()} ·{" "}
                    {row.createdBy?.name || row.createdBy?.email || "Unknown admin"} · {row.sourceAction}
                  </p>
                </div>
                <div className="wb-history-actions">
                  {latest !== null && row.versionNumber !== latest ? (
                    <button type="button" onClick={() => void compare(row.versionNumber, latest)}>
                      Compare with current
                    </button>
                  ) : (
                    <span className="wb-history-current">Current</span>
                  )}
                  {latest !== null && row.versionNumber !== latest ? (
                    <button
                      type="button"
                      className="wb-history-restore"
                      onClick={() => setConfirming(row.versionNumber)}
                    >
                      Restore
                    </button>
                  ) : null}
                </div>
              </div>

              {confirming === row.versionNumber ? (
                <div className="wb-history-confirm" role="alertdialog" aria-label="Confirm restore">
                  <p>
                    Restore <strong>v{row.versionNumber}</strong>? The current content will be
                    replaced by this version and saved as a new version. Publication status is not
                    changed, and versions v{row.versionNumber + 1}–v{latest} stay in the history.
                  </p>
                  <div>
                    <button type="button" onClick={() => void restore(row.versionNumber)}>
                      Yes, restore v{row.versionNumber}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {compareTo === row.versionNumber && changes ? (
                <div className="wb-history-compare">
                  <h4>
                    What changed between v{row.versionNumber} and the current v{latest}
                  </h4>
                  {changes.length ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>v{row.versionNumber}</th>
                          <th>Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change) => (
                          <tr key={change.field}>
                            <th scope="row">{label(change.field)}</th>
                            <td>{readable(change.from)}</td>
                            <td>{readable(change.to)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>These two versions are identical.</p>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Candidate = {
  entityType: string;
  entityId: string;
  label: string;
  slug: string;
  status: string;
  path: string;
};
type Resolution = {
  missing: boolean;
  isPublished: boolean;
  path: string | null;
  label: string | null;
  status: string | null;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF]";

export function encodeInternalLink(entityType: string, entityId: string) {
  return `internal://${entityType}/${entityId}`;
}
function parseInternalLink(value: string): { entityType: string; entityId: string } | null {
  const match = /^internal:\/\/([a-z]+)\/([^/]+)$/.exec(value.trim());
  return match ? { entityType: match[1], entityId: match[2] } : null;
}

async function api<T>(path: string): Promise<T> {
  const response = await authFetch(`/api/v1/admin/internal-links${path}`);
  const body = (await response.json()) as {
    data?: T;
    error?: { message?: string } | null;
  };
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

/** A text field for any admin-entered URL (CTA links, related-link rows)
 * that also lets the editor pick a real internal record instead of typing
 * a path by hand. Picking one stores a stable `internal://type/id`
 * reference rather than a hardcoded path, so the link keeps resolving
 * correctly even after the target's slug changes -- the public renderer
 * resolves it live at render time (see PageSectionRenderer.tsx). Plain
 * paths, anchors and external https:// URLs still work exactly as before;
 * this only adds a second way to fill the same field. */
export function InternalLinkPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  const parsed = parseInternalLink(value);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!parsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResolution(null);
      return;
    }
    let cancelled = false;
    api<Resolution>(
      `/resolve?entityType=${encodeURIComponent(parsed.entityType)}&entityId=${encodeURIComponent(parsed.entityId)}`,
    )
      .then((result) => {
        if (!cancelled) setResolution(result);
      })
      .catch(() => {
        if (!cancelled) setResolution(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function search() {
    setLoading(true);
    try {
      const rows = await api<Candidate[]>(`/search?q=${encodeURIComponent(query)}`);
      setResults(rows);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={fieldId}>{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="/path, https://..., or pick an internal page"
          className={`${inputClass} mt-0`}
        />
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            void search();
          }}
          className="mt-1 shrink-0 rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm font-semibold"
        >
          Browse
        </button>
      </div>
      {parsed ? (
        resolution === null ? (
          <p className="mt-1 text-xs text-[#828B9B]">Checking link…</p>
        ) : resolution.missing ? (
          <p className="mt-1 text-xs text-red-700" role="alert">
            This linked page no longer exists.
          </p>
        ) : !resolution.isPublished ? (
          <p className="mt-1 text-xs text-amber-700" role="alert">
            Points to &quot;{resolution.label}&quot;, which is not yet published
            ({resolution.status}).
          </p>
        ) : (
          <p className="mt-1 text-xs text-[#1A7F37]">
            Links to {resolution.path} ({resolution.label}) — stays correct even if
            the slug changes.
          </p>
        )
      ) : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${fieldId}-dialog-heading`}
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id={`${fieldId}-dialog-heading`} className="text-lg font-semibold">
                Link to a page
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[#E8ECF3] px-3 py-1 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <label className="sr-only" htmlFor={`${fieldId}-search`}>
                Search
              </label>
              <input
                id={`${fieldId}-search`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search countries, universities, scholarships…"
                className={`${inputClass} mt-0`}
              />
              <button
                type="submit"
                className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
              >
                Search
              </button>
            </form>
            {loading ? (
              <p role="status" className="mt-5 text-sm text-[#667085]">
                Searching…
              </p>
            ) : results.length ? (
              <div className="mt-4 space-y-2">
                {results.map((row) => (
                  <button
                    type="button"
                    key={`${row.entityType}-${row.entityId}`}
                    onClick={() => {
                      onChange(encodeInternalLink(row.entityType, row.entityId));
                      setOpen(false);
                    }}
                    className="block w-full rounded-xl border border-[#E8ECF3] p-3 text-left hover:border-[#1657CF]"
                  >
                    <strong className="block">{row.label}</strong>
                    <span className="mt-1 block text-xs text-[#667085]">
                      {row.entityType} · {row.path} · {row.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p role="status" className="mt-5 text-sm text-[#667085]">
                No matches yet — try a search term.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

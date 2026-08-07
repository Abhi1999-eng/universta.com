"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type ArchivedAsset = {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  title?: string | null;
  altText?: string | null;
  folder?: string | null;
  deletedAt?: string | null;
};

type Envelope<T> = {
  data: T | null;
  error: { message?: string } | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/media-recovery${path}`, init);
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data as T;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ArchivedMediaRecovery() {
  const [assets, setAssets] = useState<ArchivedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await api<ArchivedAsset[]>("");
    setAssets(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void api<ArchivedAsset[]>("")
      .then((rows) => {
        if (!cancelled) setAssets(rows);
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load archived media");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function removePermanently(asset: ArchivedAsset) {
    const label = asset.title || asset.originalFileName;
    if (!window.confirm(`Permanently delete the archived record for “${label}”? This cannot be undone.`)) {
      return;
    }

    setDeletingId(asset.id);
    setMessage("");
    try {
      await api(`/${asset.id}`, { method: "DELETE" });
      setMessage("Archived media record permanently deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to permanently delete archived media");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-[1240px] rounded-2xl border border-[#E8ECF3] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">
            Recovery
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Archived media</h3>
          <p className="mt-2 max-w-3xl text-sm text-[#667085]">
            Media archived by the current storage adapter has already been removed from local
            storage. Use this section to permanently remove the leftover archived database record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-[#D9E0EA] px-3 py-2 text-xs font-semibold"
        >
          Refresh
        </button>
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      {loading ? <p className="mt-5 text-sm text-[#667085]">Loading archived media…</p> : null}

      {!loading && assets.length === 0 ? (
        <p className="mt-5 text-sm text-[#667085]">No archived media records.</p>
      ) : null}

      <div className="mt-5 space-y-3">
        {assets.map((asset) => (
          <article
            key={asset.id}
            className="flex flex-col gap-3 rounded-xl border border-[#E8ECF3] bg-[#FBFCFE] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {asset.title || asset.originalFileName}
              </p>
              <p className="mt-1 truncate text-xs text-[#667085]">{asset.originalFileName}</p>
              <p className="mt-1 text-xs text-[#828B9B]">
                {asset.mimeType} · {formatSize(asset.fileSizeBytes)}
                {asset.folder ? ` · ${asset.folder}` : ""}
                {asset.deletedAt
                  ? ` · Archived ${new Date(asset.deletedAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={deletingId === asset.id}
              onClick={() => void removePermanently(asset)}
              className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingId === asset.id ? "Deleting…" : "Delete permanently"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

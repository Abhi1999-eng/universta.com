"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth/auth-client";

type Asset = {
  id: string;
  publicUrl: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  title?: string | null;
  altText?: string | null;
  caption?: string | null;
  folder?: string | null;
  inUse: boolean;
  createdAt: string;
};
type Envelope<T> = { data: T | null; error: { message?: string } | null };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`/api/v1/admin/media${path}`, init);
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.error)
    throw new Error(body.error?.message ?? "Request failed");
  return body.data as T;
}

export function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (folder.trim()) params.set("folder", folder.trim());
      const query = params.toString();
      const data = await api<Asset[]>(query ? `?${query}` : "");
      setAssets(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load media");
    }
  }, [q, folder]);

  useEffect(() => {
    // Reloads whenever the search/folder filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (titleRef.current?.value) form.append("title", titleRef.current.value);
      if (altRef.current?.value) form.append("altText", altRef.current.value);
      if (folderRef.current?.value) form.append("folder", folderRef.current.value);
      await api<Asset>("", { method: "POST", body: form });
      setMessage("Uploaded.");
      if (fileRef.current) fileRef.current.value = "";
      if (titleRef.current) titleRef.current.value = "";
      if (altRef.current) altRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveMeta(asset: Asset, patch: Partial<Asset>) {
    try {
      await api(`/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: patch.title ?? asset.title ?? "",
          altText: patch.altText ?? asset.altText ?? "",
          caption: patch.caption ?? asset.caption ?? "",
          folder: patch.folder ?? asset.folder ?? "",
        }),
      });
      setMessage("Saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    }
  }

  async function archive(asset: Asset) {
    try {
      await api(`/${asset.id}`, { method: "DELETE" });
      setMessage("Archived.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive — it may still be in use");
    }
  }

  return (
    <section className="mx-auto max-w-[1240px]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#828B9B]">Media</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Media library</h2>
        <p className="mt-2 text-sm text-[#667085]">
          Upload images for use across Pages, Universities, Scholarships, Consultants,
          Events, Success Stories and Testimonials. Accepted types: JPEG, PNG, WEBP, GIF —
          up to 5MB.
        </p>
      </div>

      <form
        onSubmit={(event) => void upload(event)}
        className="mt-6 grid gap-4 rounded-2xl border border-[#E8ECF3] bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="text-sm font-semibold" htmlFor="media-file">
            File
          </label>
          <input
            id="media-file"
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="media-title">
            Title (optional)
          </label>
          <input
            id="media-title"
            ref={titleRef}
            className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="media-alt">
            Alt text (optional)
          </label>
          <input
            id="media-alt"
            ref={altRef}
            className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold" htmlFor="media-folder">
            Folder (optional)
          </label>
          <input
            id="media-folder"
            ref={folderRef}
            className="mt-1 w-full rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={uploading}
            className="rounded-xl bg-[#1657CF] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search title, alt text or filename"
          aria-label="Search media"
          className="w-64 rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
        />
        <input
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder="Filter by folder"
          aria-label="Filter by folder"
          className="w-48 rounded-xl border border-[#D9E0EA] bg-white px-3 py-2.5 text-sm"
        />
      </div>

      {message ? (
        <p className="mt-4 text-sm text-[#48505F]" role="status">
          {message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <article key={asset.id} className="rounded-2xl border border-[#E8ECF3] bg-white p-4">
            <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl bg-[#F7F9FC]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.publicUrl.replace("/media/", "/api/v1/media/")}
                alt={asset.altText ?? asset.originalFileName}
                className="max-h-36 max-w-full object-contain"
              />
            </div>
            <p className="mt-3 truncate text-sm font-semibold" title={asset.originalFileName}>
              {asset.title || asset.originalFileName}
            </p>
            <p className="text-xs text-[#828B9B]">
              {asset.mimeType} · {formatSize(asset.fileSizeBytes)}
              {asset.inUse ? " · In use" : ""}
            </p>
            <div className="mt-3 space-y-2">
              <input
                defaultValue={asset.altText ?? ""}
                placeholder="Alt text"
                aria-label={`Alt text for ${asset.originalFileName}`}
                onBlur={(event) => void saveMeta(asset, { altText: event.target.value })}
                className="w-full rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
              />
              <input
                defaultValue={asset.folder ?? ""}
                placeholder="Folder"
                aria-label={`Folder for ${asset.originalFileName}`}
                onBlur={(event) => void saveMeta(asset, { folder: event.target.value })}
                className="w-full rounded-lg border border-[#E8ECF3] px-2.5 py-1.5 text-xs"
              />
            </div>
            <button
              type="button"
              disabled={asset.inUse}
              title={asset.inUse ? "In use — remove it from every record first" : undefined}
              onClick={() => setPendingArchive(asset)}
              className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Archive
            </button>
          </article>
        ))}
        {assets.length === 0 ? (
          <p className="text-sm text-[#667085]">No media uploaded yet.</p>
        ) : null}
      </div>

      {pendingArchive ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-media-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="archive-media-title" className="text-lg font-semibold">
              Archive this file?
            </h3>
            <p className="mt-2 text-sm text-[#667085]">
              {pendingArchive.title || pendingArchive.originalFileName} will be removed from
              the library and deleted from local storage.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-[#D9E0EA] px-4 py-2 text-sm font-semibold"
                onClick={() => setPendingArchive(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void archive(pendingArchive);
                  setPendingArchive(null);
                }}
              >
                Archive file
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

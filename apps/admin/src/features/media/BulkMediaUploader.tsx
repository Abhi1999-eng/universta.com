'use client';

import { useRef, useState } from 'react';
import { titleFromFilename, uploadMediaFile, validateMediaFile } from './media-upload';

type RowStatus = 'waiting' | 'uploading' | 'uploaded' | 'failed';
type Row = { file: File; status: RowStatus; error?: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Bulk upload for the Media Library. Each file is a real, independent
 * upload against the existing single-file endpoint, so a later failure
 * never rolls back an earlier success -- there is nothing to roll back. */
export function BulkMediaUploader({
  folder,
  onDone,
  onClose,
}: {
  folder?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).map((file) => {
      const validationError = validateMediaFile(file);
      return { file, status: (validationError ? 'failed' : 'waiting') as RowStatus, error: validationError ?? undefined };
    });
    setRows((current) => [...current, ...incoming]);
  }

  async function runOne(index: number) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, status: 'uploading', error: undefined } : row)));
    try {
      await uploadMediaFile(rows[index].file, { title: titleFromFilename(rows[index].file.name), folder });
      setRows((current) => current.map((row, i) => (i === index ? { ...row, status: 'uploaded' } : row)));
      return true;
    } catch (cause) {
      setRows((current) =>
        current.map((row, i) =>
          i === index ? { ...row, status: 'failed', error: cause instanceof Error ? cause.message : 'Upload failed' } : row,
        ),
      );
      return false;
    }
  }

  async function start() {
    if (running) return; // Prevent duplicate submission while a batch is in flight.
    setRunning(true);
    let anySucceeded = false;
    for (let i = 0; i < rows.length; i += 1) {
      if (rows[i].status === 'uploaded') {
        anySucceeded = true;
        continue;
      }
      if (rows[i].status === 'failed' && rows[i].error && validateMediaFile(rows[i].file)) continue; // invalid type/size — do not retry automatically
      const ok = await runOne(i); // sequential so per-file status updates render as they happen
      if (ok) anySucceeded = true;
    }
    setRunning(false);
    if (anySucceeded) onDone();
  }

  async function retry(index: number) {
    if (running) return;
    const ok = await runOne(index);
    if (ok) onDone();
  }

  const waiting = rows.filter((row) => row.status === 'waiting').length;
  const uploaded = rows.filter((row) => row.status === 'uploaded').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  const hasQueue = rows.some((row) => row.status === 'waiting' || row.status === 'failed');

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
        }}
        className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center ${
          dragOver ? 'border-[#1657CF] bg-[#F3F7FF]' : 'border-[#D9E0EA] bg-white'
        }`}
      >
        <p className="text-sm text-[#667085]">
          Drag and drop multiple images here, or click to choose files.
          <br />
          <span className="text-xs">JPEG, PNG, WEBP or GIF — up to 5MB each.</span>
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) addFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {rows.length ? (
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[#E8ECF3] p-3">
          {rows.map((row, index) => (
            <div key={`${row.file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#E8ECF3] px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{row.file.name}</p>
                <p className="text-xs text-[#828B9B]">
                  {formatSize(row.file.size)}
                  {row.error ? ` · ${row.error}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  role="status"
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    row.status === 'uploaded'
                      ? 'bg-[#E9F8F0] text-[#18794E]'
                      : row.status === 'failed'
                        ? 'bg-[#FDECEC] text-[#B42318]'
                        : row.status === 'uploading'
                          ? 'bg-[#E7EFFE] text-[#1657CF]'
                          : 'bg-[#F2F4F7] text-[#667085]'
                  }`}
                >
                  {row.status === 'waiting'
                    ? 'Waiting'
                    : row.status === 'uploading'
                      ? 'Uploading…'
                      : row.status === 'uploaded'
                        ? 'Uploaded'
                        : 'Failed'}
                </span>
                {row.status === 'failed' && validateMediaFile(row.file) === null ? (
                  <button
                    type="button"
                    onClick={() => void retry(index)}
                    disabled={running}
                    className="rounded-lg border border-[#D9E0EA] px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {rows.length ? (
        <p role="status" className="text-sm text-[#667085]">
          {uploaded} uploaded · {failed} failed · {waiting} waiting
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold">
          Close
        </button>
        <button
          type="button"
          onClick={() => void start()}
          disabled={running || !hasQueue}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {running ? 'Uploading…' : 'Start upload'}
        </button>
      </div>
    </div>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from 'react';
import {
  ACCEPTED_MEDIA_ACCEPT,
  titleFromFilename,
  uploadMediaFile,
  validateMediaFile,
  type UploadedMediaAsset,
} from './media-upload';

export function MediaUploader({
  onUploaded,
  onCancel,
}: {
  onUploaded: (asset: UploadedMediaAsset) => void;
  onCancel?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [folder, setFolder] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileFieldId = useId();

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(nextFile: File | null) {
    setError('');
    if (!nextFile) {
      setFile(null);
      setPreview('');
      return;
    }
    const validationError = validateMediaFile(nextFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      setPreview('');
      return;
    }
    setFile(nextFile);
    setTitle((current) => current || titleFromFilename(nextFile.name));
    setPreview(URL.createObjectURL(nextFile));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      const asset = await uploadMediaFile(file, {
        title: title || undefined,
        altText: altText || undefined,
        folder: folder || undefined,
      });
      onUploaded(asset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          pick(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-center ${
          dragOver ? 'border-[#1657CF] bg-[#F3F7FF]' : 'border-[#D9E0EA] bg-white'
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt="Selected file preview"
            className="max-h-32 rounded-lg object-contain"
          />
        ) : (
          <p className="text-sm text-[#667085]">
            Drag and drop an image here, or click to choose from your device.
            <br />
            <span className="text-xs">JPEG, PNG, WEBP or GIF — up to 5MB.</span>
          </p>
        )}
        {file ? (
          <p className="max-w-full truncate text-xs font-semibold text-[#48505F]">
            {file.name}
          </p>
        ) : null}
      </div>
      <label className="sr-only" htmlFor={fileFieldId}>
        Choose an image file
      </label>
      <input
        id={fileFieldId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MEDIA_ACCEPT}
        className="sr-only"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Alt text
          <input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Folder (optional)
          <input
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[#D9E0EA] px-3 py-2 font-normal"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[#B42318]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="rounded-xl border border-[#D9E0EA] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Back to library
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload and use image'}
        </button>
      </div>
    </form>
  );
}

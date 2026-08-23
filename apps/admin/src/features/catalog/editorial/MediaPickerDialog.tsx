'use client';
/* Existing catalog media can be hosted on approved external origins. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import type { EditorialMedia } from '../catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { MediaUploader } from '@/features/media/MediaUploader';
import {
  listActiveMediaLibrary,
  toEditorialMedia,
} from '@/features/media/media-upload';
import { commonFieldHelp } from '@/lib/field-help/common';
import type { FieldHelpContent } from '@/lib/field-help/types';

type Tab = 'library' | 'upload';

export function MediaPickerDialog({
  label,
  value,
  media = [],
  onChange,
  onSelectMedia,
  compact = false,
  disabled = false,
  help,
  helpKey,
}: {
  label: string;
  value: string;
  media?: EditorialMedia[];
  onChange: (value: string) => void;
  onSelectMedia?: (media: EditorialMedia) => void;
  compact?: boolean;
  disabled?: boolean;
  /** Inline help content; falls back to the shared "media" definition when
   * neither this nor `helpKey` is provided, since every current caller is a
   * media-picker field. */
  help?: FieldHelpContent;
  helpKey?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EditorialMedia[]>(media);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function loadLibrary(searchQuery = '') {
    setLoading(true);
    setError('');
    try {
      const items = await listActiveMediaLibrary(searchQuery, 50);
      setResults(items);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load Media Library images.',
      );
    } finally {
      setLoading(false);
    }
  }

  function openPicker(initialTab: Tab = 'library') {
    if (disabled) return;
    setTab(initialTab);
    setOpen(true);
    if (initialTab === 'library') void loadLibrary();
  }

  function close() {
    setOpen(false);
    window.setTimeout(() => trigger.current?.focus(), 0);
  }
  function selectMedia(item: EditorialMedia) {
    onChange(item.id);
    onSelectMedia?.(item);
    close();
  }

  const selected =
    results.find((item) => item.id === value) ??
    media.find((item) => item.id === value) ??
    null;
  const resolvedHelp = help ?? (helpKey ? undefined : commonFieldHelp.media);

  return (
    <div>
      <span className={compact ? 'sr-only' : 'block text-sm font-semibold'}>
        <FieldLabel label={label} help={resolvedHelp} helpKey={helpKey} />
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          ref={trigger}
          type="button"
          disabled={disabled}
          onClick={() => openPicker('library')}
          className={compact ? 'rounded-lg border border-[#D9E0EA] px-2.5 py-1.5 text-xs font-semibold hover:border-[#1657CF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-[#98A2B3]' : 'rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45'}
        >
          {compact ? 'Image' : selected ? 'Change media' : 'Choose media'}
        </button>
        {selected ? (
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={selected.url}
              alt={selected.alt || selected.title || ''}
              className="h-12 w-16 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 text-xs">
              <p className="truncate font-semibold text-[#48505F]">
                {selected.title || selected.alt || 'Selected image'}
              </p>
              {selected.alt ? (
                <p className="truncate text-[#828B9B]">Alt: {selected.alt}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="shrink-0 text-xs font-semibold text-[#B42318]"
            >
              Remove
            </button>
          </div>
        ) : (
          <span className="text-xs text-[#828B9B]">No media selected</span>
        )}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-picker-heading"
            tabIndex={-1}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="media-picker-heading" className="text-xl font-semibold">
                Select image
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close media picker"
                className="rounded-lg border px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-2 border-b border-[#E8ECF3]">
              <button
                type="button"
                onClick={() => {
                  setTab('library');
                  void loadLibrary(query);
                }}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === 'library'
                    ? 'border-b-2 border-[#1657CF] text-[#1657CF]'
                    : 'text-[#667085]'
                }`}
              >
                Choose from Media Library
              </button>
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === 'upload'
                    ? 'border-b-2 border-[#1657CF] text-[#1657CF]'
                    : 'text-[#667085]'
                }`}
              >
                Upload from device
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {tab === 'upload' ? (
                <MediaUploader
                  onCancel={() => {
                    setTab('library');
                    void loadLibrary(query);
                  }}
                    onUploaded={(asset) => {
                    const editorialMedia = toEditorialMedia(asset);
                    setResults((current) => [
                      editorialMedia,
                      ...current.filter((item) => item.id !== editorialMedia.id),
                    ]);
                    selectMedia(editorialMedia);
                  }}
                />
              ) : (
                <>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadLibrary(query);
                    }}
                  >
                    <label className="sr-only" htmlFor="media-search">
                      Search media
                    </label>
                    <input
                      id="media-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search title, alt text or filename"
                      className="w-full rounded-xl border border-[#D9E0EA] px-3 py-2"
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
                      Loading Media Library…
                    </p>
                  ) : error ? (
                    <div className="mt-5 rounded-xl bg-[#FFF7F7] p-4">
                      <p role="alert" className="text-sm text-[#B42318]">
                        {error}
                      </p>
                      <button
                        type="button"
                        onClick={() => void loadLibrary(query)}
                        className="mt-3 text-sm font-semibold text-[#1657CF]"
                      >
                        Try again
                      </button>
                    </div>
                  ) : results.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {results.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => selectMedia(item)}
                          className={`flex gap-3 rounded-xl border p-3 text-left hover:border-[#1657CF] ${
                            item.id === value
                              ? 'border-[#1657CF] bg-[#F3F7FF]'
                              : 'border-[#E8ECF3]'
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={item.alt || item.title || ''}
                            className="h-16 w-20 rounded-lg object-cover"
                          />
                          <span className="min-w-0 text-xs">
                            <strong className="block truncate">
                              {item.title || item.alt || 'Untitled image'}
                            </strong>
                            <span className="mt-1 block text-[#667085]">
                              {item.width && item.height
                                ? `${item.width}×${item.height}`
                                : 'Image'}
                            </span>
                            <span className="mt-1 block truncate text-[#667085]">
                              {item.alt || 'Alt text unavailable'}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-[#D9E0EA] p-5 text-center">
                      <p role="status" className="text-sm text-[#667085]">
                        No active images found in Media Library.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('upload')}
                        className="mt-3 rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Upload from device
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

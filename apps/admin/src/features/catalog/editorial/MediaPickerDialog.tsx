'use client';
/* Existing catalog media can be hosted on approved external origins. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { listEditorialMedia } from '../catalog-client';
import type { EditorialMedia } from '../catalog.types';
import { MediaUploader } from '@/features/media/MediaUploader';
import { toEditorialMedia } from '@/features/media/media-upload';

type Tab = 'library' | 'upload';

export function MediaPickerDialog({
  label,
  value,
  media,
  onChange,
}: {
  label: string;
  value: string;
  media: EditorialMedia[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(media);
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

  async function search() {
    setLoading(true);
    setError('');
    try {
      const response = await listEditorialMedia({ q: query, limit: 24 });
      setResults(response.data);
    } catch {
      setError('Unable to search media.');
    } finally {
      setLoading(false);
    }
  }

  function openPicker(initialTab: Tab = 'library') {
    setTab(initialTab);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    window.setTimeout(() => trigger.current?.focus(), 0);
  }

  const selected = (results.find((item) => item.id === value) ?? media.find((item) => item.id === value)) || null;

  return (
    <div>
      <span className="block text-sm font-semibold">{label}</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          ref={trigger}
          type="button"
          onClick={() => openPicker('library')}
          className="rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm font-semibold"
        >
          {selected ? 'Change media' : 'Choose media'}
        </button>
        {selected ? (
          <div className="flex items-center gap-3">
            <img src={selected.url} alt={selected.alt || selected.title || ''} className="h-12 w-16 rounded-lg object-cover" />
            <div className="text-xs">
              <p className="font-semibold text-[#48505F]">{selected.title || selected.alt || 'Selected image'}</p>
              {selected.alt ? <p className="text-[#828B9B]">Alt: {selected.alt}</p> : null}
            </div>
            <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-[#B42318]">
              Remove
            </button>
          </div>
        ) : (
          <span className="text-xs text-[#828B9B]">No media selected</span>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation">
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
                Select media
              </h2>
              <button type="button" onClick={close} aria-label="Close media picker" className="rounded-lg border px-3 py-2 text-sm font-semibold">
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-2 border-b border-[#E8ECF3]">
              <button
                type="button"
                onClick={() => setTab('library')}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${tab === 'library' ? 'border-b-2 border-[#1657CF] text-[#1657CF]' : 'text-[#667085]'}`}
              >
                Choose from Media Library
              </button>
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${tab === 'upload' ? 'border-b-2 border-[#1657CF] text-[#1657CF]' : 'text-[#667085]'}`}
              >
                Upload new
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              {tab === 'upload' ? (
                <MediaUploader
                  onCancel={() => setTab('library')}
                  onUploaded={(asset) => {
                    const editorialMedia = toEditorialMedia(asset);
                    setResults((current) => [editorialMedia, ...current]);
                    onChange(editorialMedia.id);
                    close();
                  }}
                />
              ) : (
                <>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void search();
                    }}
                  >
                    <label className="sr-only" htmlFor="media-search">
                      Search media
                    </label>
                    <input
                      id="media-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search title or alt text"
                      className="w-full rounded-xl border border-[#D9E0EA] px-3 py-2"
                    />
                    <button type="submit" className="rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white">
                      Search
                    </button>
                  </form>
                  {loading ? (
                    <p role="status" className="mt-5 text-sm text-[#667085]">
                      Loading media…
                    </p>
                  ) : error ? (
                    <p role="alert" className="mt-5 text-sm text-[#B42318]">
                      {error}
                    </p>
                  ) : results.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {results.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            onChange(item.id);
                            close();
                          }}
                          className={`flex gap-3 rounded-xl border p-3 text-left hover:border-[#1657CF] ${item.id === value ? 'border-[#1657CF] bg-[#F3F7FF]' : 'border-[#E8ECF3]'}`}
                        >
                          <img src={item.url} alt={item.alt || item.title || ''} className="h-16 w-20 rounded-lg object-cover" />
                          <span className="min-w-0 text-xs">
                            <strong className="block truncate">{item.title || item.alt || 'Untitled image'}</strong>
                            <span className="mt-1 block text-[#667085]">
                              {item.width && item.height ? `${item.width}×${item.height}` : 'Dimensions unavailable'}
                            </span>
                            <span className="mt-1 block text-[#667085]">{item.alt || 'Alt text unavailable'}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-dashed border-[#D9E0EA] p-5 text-center">
                      <p role="status" className="text-sm text-[#667085]">
                        No active images are available. Upload a new image here or add files through Media Library.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab('upload')}
                        className="mt-3 rounded-xl bg-[#1657CF] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Upload new
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

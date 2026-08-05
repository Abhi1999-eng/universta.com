'use client';
/* Existing catalog media can be hosted on approved external origins. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { listEditorialMedia } from '../catalog-client';
import type { EditorialMedia } from '../catalog.types';
import { FieldLabel } from '@/features/shared/FieldLabel';
import { commonFieldHelp } from '@/lib/field-help/common';
import type { FieldHelpContent } from '@/lib/field-help/types';

export function MediaPickerDialog({
  label,
  value,
  media,
  onChange,
  help,
  helpKey,
}: {
  label: string;
  value: string;
  media: EditorialMedia[];
  onChange: (value: string) => void;
  /** Inline help content; falls back to the shared "media" definition when
   * neither this nor `helpKey` is provided, since every current caller is a
   * media-picker field. */
  help?: FieldHelpContent;
  helpKey?: string;
}) {
  const [open, setOpen] = useState(false);
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

  function close() {
    setOpen(false);
    window.setTimeout(() => trigger.current?.focus(), 0);
  }

  const selected = media.find((item) => item.id === value);
  const resolvedHelp = help ?? (helpKey ? undefined : commonFieldHelp.media);

  return (
    <div>
      <span className="block text-sm font-semibold">
        <FieldLabel label={label} help={resolvedHelp} helpKey={helpKey} />
      </span>
      <div className="mt-2 flex items-center gap-2">
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-[#D9E0EA] px-3 py-2 text-sm font-semibold"
        >
          {selected ? 'Replace media' : 'Choose media'}
        </button>
        {selected ? (
          <>
            <span className="text-xs text-[#667085]">
              {selected.title || selected.alt || 'Selected image'}
              {selected.width && selected.height ? ` · ${selected.width}×${selected.height}` : ''}
            </span>
            <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-[#B42318]">
              Remove
            </button>
          </>
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
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="media-picker-heading" className="text-xl font-semibold">
                Choose existing media
              </h2>
              <button type="button" onClick={close} className="rounded-lg border px-3 py-2 text-sm font-semibold">
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
                    className="flex gap-3 rounded-xl border border-[#E8ECF3] p-3 text-left hover:border-[#1657CF]"
                  >
                    <img src={item.url} alt={item.alt || item.title || ''} className="h-16 w-20 rounded-lg object-cover" />{' '}
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
              <p role="status" className="mt-5 text-sm text-[#667085]">
                No active image media found.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

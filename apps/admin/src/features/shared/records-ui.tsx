'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { webOrigin } from '@/lib/web-origin';

/**
 * The pieces every admin list shares, so a record behaves the same way on
 * every screen: one status badge, one row of actions (Edit, then the one
 * publishing action that applies, then the rest behind "More"), one toast
 * for what just happened, and a summary line over the table.
 */

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  PUBLISHED: { label: 'Published', tone: 'p-badge--ok' },
  DRAFT: { label: 'Draft', tone: 'p-badge--visa' },
  ARCHIVED: { label: 'Archived', tone: '' },
  ACTIVE: { label: 'Active', tone: 'p-badge--ok' },
  INACTIVE: { label: 'Inactive', tone: '' },
  NEW: { label: 'New', tone: 'p-badge--visa' },
  CONVERTED: { label: 'Converted', tone: 'p-badge--ok' },
};

export function statusLabel(status: string | null | undefined) {
  if (!status) return '—';
  const known = STATUS_LABELS[status];
  if (known) return known.label;
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const tone = status ? (STATUS_LABELS[status]?.tone ?? '') : '';
  return <span className={`p-badge ${tone}`.trim()}>{statusLabel(status)}</span>;
}

/** "14 records · 12 published · 2 draft". Each count is its own node so a
 * test (or a reader) can pick the total out on its own. */
export function ListSummary({
  total,
  published,
  draft,
  noun = 'record',
}: {
  total: number | null;
  published?: number | null;
  draft?: number | null;
  noun?: string;
}) {
  if (total === null) return null;
  return (
    <p className="p-sub" aria-label="List summary">
      <span>{`${total} ${noun}${total === 1 ? '' : 's'}`}</span>
      {typeof published === 'number' ? <span>{` · ${published} published`}</span> : null}
      {typeof draft === 'number' ? <span>{` · ${draft} draft`}</span> : null}
    </p>
  );
}

export function ViewOnSite({ path, label = 'View on site' }: { path: string; label?: string }) {
  return (
    <a href={`${webOrigin()}${path}`} target="_blank" rel="noreferrer" className="p-link text-xs">
      {label} ↗
    </a>
  );
}

export type RowMenuItem = { label: string; onSelect: () => void; danger?: boolean };

/** The "⋯" at the end of a row: what is rarely needed, and what is
 * destructive, so neither competes with Publish for the eye. */
export function RowMenu({ items, label = 'More actions' }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="p-menu" ref={root}>
      <button
        type="button"
        className="p-btn p-btn--ghost p-btn--sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="p-menu__panel" role="menu" id={id}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? 'p-danger' : undefined}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type Toast = {
  id: number;
  /* `success` is the green confirmation that an editor's Publish landed;
     `ok` stays the quiet navy note for row actions. */
  tone: 'ok' | 'success' | 'error';
  text: string;
  action?: { label: string; onSelect: () => void };
};

/** What just happened, in the corner, in one line: "Imperial College London
 * published." A success goes by itself; a failure stays until closed, with
 * the way to fix it beside the reason. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (tone: Toast['tone'], text: string, action?: Toast['action']) => {
      const id = ++counter.current;
      setToasts((current) => [...current.slice(-3), { id, tone, text, action }]);
      if (tone !== 'error') window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return { toasts, push, dismiss };
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  /* Nothing to say, nothing in the document: an empty live region still
     counts as "a status" to anyone looking for one, and the session check
     and the flash banners are statuses of their own. */
  if (!toasts.length) return null;
  return (
    <div className="p-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} data-toast-tone={toast.tone} className={`p-toast${toast.tone === 'error' ? ' p-toast--error' : toast.tone === 'success' ? ' p-toast--success' : ''}`}>
          <span className="flex-1">{toast.text}</span>
          {toast.action ? (
            <button type="button" className="p-btn p-btn--ghost p-btn--sm" onClick={toast.action.onSelect}>
              {toast.action.label}
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss" className="opacity-70 hover:opacity-100" onClick={() => onDismiss(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function formatUpdated(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Which rows on the page are ticked, for a bulk action. The set is kept
 * only for the rows currently shown: a new page starts unticked. */
export function useRowSelection(ids: string[]) {
  /* The ticks are remembered with the rows they were made on: when the
     rows change (page, filter, reload) the old ticks simply no longer
     apply, so nothing has to be cleared by hand. */
  const key = ids.join('|');
  const [state, setState] = useState<{ key: string; selected: Set<string> }>(() => ({ key, selected: new Set() }));
  const selected = useMemo(() => (state.key === key ? state.selected : new Set<string>()), [state, key]);
  const toggle = useCallback((id: string, on: boolean) => {
    setState((current) => {
      const next = new Set(current.key === key ? current.selected : []);
      if (on) next.add(id);
      else next.delete(id);
      return { key, selected: next };
    });
  }, [key]);
  const toggleAll = useCallback((on: boolean) => setState({ key, selected: on ? new Set(ids) : new Set() }), [ids, key]);
  const clear = useCallback(() => setState({ key, selected: new Set() }), [key]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  return useMemo(() => ({ selected, has: (id: string) => selected.has(id), count: selected.size, toggle, toggleAll, clear, allSelected }), [selected, toggle, toggleAll, clear, allSelected]);
}

export function SelectAllCheckbox({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return <input type="checkbox" aria-label="Select all on this page" checked={checked} onChange={(event) => onChange(event.target.checked)} />;
}
export function RowCheckbox({ name, checked, onChange }: { name: string; checked: boolean; onChange: (on: boolean) => void }) {
  return <input type="checkbox" aria-label={`Select ${name}`} checked={checked} onChange={(event) => onChange(event.target.checked)} />;
}

/** The bar over the table once something is ticked: how many, and the two
 * things that can be done to them at once. */
export function BulkBar({ count, busy, onPublish, onUnpublish, onClear }: { count: number; busy: boolean; onPublish: () => void; onUnpublish: () => void; onClear: () => void }) {
  if (!count) return null;
  return (
    <div className="a-grid__bulk" role="region" aria-label="Bulk actions">
      <span className="font-semibold">{count} selected</span>
      <button type="button" className="p-btn p-btn--primary p-btn--sm" disabled={busy} onClick={onPublish}>{busy ? 'Working…' : `Publish ${count}`}</button>
      <button type="button" className="p-btn p-btn--ghost p-btn--sm" disabled={busy} onClick={onUnpublish}>Unpublish {count}</button>
      <button type="button" className="p-btn p-btn--text p-btn--sm" disabled={busy} onClick={onClear}>Clear</button>
    </div>
  );
}

/** One line for what a bulk action did: "3 published · 1 failed: X (reason)". */
export function bulkSummary(kind: 'publish' | 'unpublish', done: number, skipped: number, failed: string[]) {
  const verb = kind === 'publish' ? 'published' : 'moved to draft';
  const parts = [`${done} ${verb}`];
  if (skipped) parts.push(`${skipped} already ${kind === 'publish' ? 'published' : 'draft'}`);
  if (failed.length) parts.push(`${failed.length} failed: ${failed.join(' · ')}`);
  return parts.join(' · ') + '.';
}

/** A list's filters, kept in the address so a refresh, Back, a shared link
 * or a dashboard shortcut ("?status=DRAFT") opens the same view. Empty
 * values and page 1 stay out of the address. */
export function useFiltersInUrl(values: Record<string, string | number | undefined>) {
  const serialized = JSON.stringify(values);
  useEffect(() => {
    const current = window.location.search.replace(/^\?/, '');
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(JSON.parse(serialized) as Record<string, string | number | undefined>)) {
      const text = value === undefined || value === null ? '' : String(value);
      if (!text || (key === 'page' && text === '1')) next.delete(key);
      else next.set(key, text);
    }
    const query = next.toString();
    // The browser's own history call, which Next's router follows: the
    // address changes without asking the server for the page again.
    if (query !== current) window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [serialized]);
}

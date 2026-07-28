'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export type CompareType = 'countries' | 'universities' | 'courses' | 'consultants';

const PATHS: Record<CompareType, string> = {
  countries: '/compare/countries',
  universities: '/compare/universities',
  courses: '/compare/courses',
  consultants: '/compare/consultants',
};
const CHANGE_EVENT = 'universta:compare-change';
const MAX_ITEMS = 3;

type CompareItem = { slug: string; label: string };

function storageKey(type: CompareType) {
  return `universta:compare:${type}`;
}

function readItems(type: CompareType): CompareItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(type));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CompareItem[]) : [];
  } catch {
    return [];
  }
}

function writeItems(type: CompareType, items: CompareItem[]) {
  window.localStorage.setItem(storageKey(type), JSON.stringify(items));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useCompareItems(type: CompareType) {
  const [items, setItems] = useState<CompareItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(readItems(type));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [type]);
  return items;
}

export function CompareCheckbox({ type, slug, label }: { type: CompareType; slug: string; label: string }) {
  const items = useCompareItems(type);
  const checked = items.some((item) => item.slug === slug);
  const full = !checked && items.length >= MAX_ITEMS;

  function toggle() {
    // Read fresh from storage rather than the closed-over `items` so two
    // checkboxes clicked in quick succession don't clobber each other.
    const current = readItems(type);
    const exists = current.some((item) => item.slug === slug);
    if (exists) {
      writeItems(type, current.filter((item) => item.slug !== slug));
    } else if (current.length < MAX_ITEMS) {
      writeItems(type, [...current, { slug, label }]);
    }
  }

  return (
    <label className="cmp-check" onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        disabled={full}
        onClick={(event) => event.stopPropagation()}
        onChange={toggle}
      />
      {checked ? 'Added to compare' : full ? `Up to ${MAX_ITEMS} at a time` : 'Compare'}
    </label>
  );
}

export function CompareTray({ type }: { type: CompareType }) {
  const items = useCompareItems(type);
  if (!items.length) return null;

  function remove(slug: string) {
    writeItems(type, readItems(type).filter((item) => item.slug !== slug));
  }
  function clearAll() {
    writeItems(type, []);
  }

  return (
    <div className="compare-tray show">
      <div className="wrap tray-inner">
        <div className="tt"><span className="badge-n">{items.length}</span>Compare</div>
        <div className="tray-slots">
          {items.map((item) => (
            <div className="tray-slot filled" key={item.slug}>
              <span className="nm">{item.label}</span>
              <span className="x" onClick={() => remove(item.slug)} role="button" tabIndex={0} aria-label={`Remove ${item.label} from comparison`}>&times;</span>
            </div>
          ))}
          {items.length < MAX_ITEMS ? <span className="tray-hint">Add up to {MAX_ITEMS - items.length} more</span> : null}
        </div>
        <div className="tray-actions">
          <button type="button" className="btn-clear" onClick={clearAll}>Clear</button>
          <Link href={`${PATHS[type]}?items=${items.map((item) => item.slug).join(',')}`} className="btn btn-primary btn-sm">
            Compare {items.length > 1 ? `(${items.length})` : ''}
          </Link>
        </div>
      </div>
    </div>
  );
}

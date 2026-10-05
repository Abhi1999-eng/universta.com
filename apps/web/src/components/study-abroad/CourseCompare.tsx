'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

/**
 * The course comparison shortlist, kept between a university's course list
 * and its course pages.
 *
 * The behaviour reference keeps its compare bar in the browser, so a course
 * ticked on the list is still ticked on its own page and after a reload.
 * This is the same: a per-visitor convenience in local storage, read through
 * one store so every checkbox and the tray agree, and opened at
 * /compare/courses, which lines up to three offerings side by side.
 *
 * Storage can be missing or refuse a write (a private window, blocked site
 * data); the shortlist then lasts as long as the page, and nothing breaks.
 */

export type CompareItem = { slug: string; name: string };

export const COMPARE_LIMIT = 3;
const KEY = 'universta.compare.courses';
const EMPTY: CompareItem[] = [];

let items: CompareItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function parse(raw: string | null): CompareItem[] {
  try {
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(value)) return EMPTY;
    return value
      .filter(
        (entry): entry is CompareItem =>
          Boolean(entry) &&
          typeof (entry as CompareItem).slug === 'string' &&
          typeof (entry as CompareItem).name === 'string',
      )
      .slice(0, COMPARE_LIMIT);
  } catch {
    return EMPTY;
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    items = parse(window.localStorage.getItem(KEY));
  } catch {
    items = EMPTY;
  }
}

function write(next: CompareItem[]) {
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Kept in memory for this page instead. */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  /* Another tab changed the shortlist. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    items = parse(event.newValue);
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function snapshot() {
  load();
  return items;
}

/* The server has no shortlist: the page renders unticked, and the browser's
   own list arrives as soon as it hydrates, without a mismatch. */
const serverSnapshot = () => EMPTY;

export function useCourseCompare() {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const has = (slug: string) => list.some((entry) => entry.slug === slug);
  return {
    items: list,
    has,
    full: list.length >= COMPARE_LIMIT,
    toggle(item: CompareItem) {
      if (has(item.slug)) write(list.filter((entry) => entry.slug !== item.slug));
      else if (list.length < COMPARE_LIMIT) write([...list, item]);
    },
    remove(slug: string) {
      write(list.filter((entry) => entry.slug !== slug));
    },
    clear() {
      write(EMPTY);
    },
  };
}

export function compareHref(list: CompareItem[]) {
  return list.length
    ? `/compare/courses?items=${list.map((entry) => entry.slug).join(',')}`
    : '/compare/courses';
}

/** The card's small "Compare" tick, as the design's course card has it. */
export function CompareCheck({ item }: { item: CompareItem }) {
  const compare = useCourseCompare();
  const checked = compare.has(item.slug);
  return (
    <label className="tinycheck">
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && compare.full}
        onChange={() => compare.toggle(item)}
        aria-label={`Compare ${item.name}`}
      />
      <span>Compare</span>
    </label>
  );
}

/** The course page's "Add to comparison", the hero's version of the same. */
export function CompareButton({ item }: { item: CompareItem }) {
  const compare = useCourseCompare();
  const checked = compare.has(item.slug);
  return (
    <label className="iconbtn iconbtn--check">
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && compare.full}
        onChange={() => compare.toggle(item)}
      />
      <span>{checked ? 'In your comparison' : 'Add to comparison'}</span>
    </label>
  );
}

/** The navy bar along the foot of the screen while anything is shortlisted. */
export function CompareTray() {
  const compare = useCourseCompare();
  if (!compare.items.length) return null;
  return (
    <div
      className="tray tray--courses"
      data-open="true"
      role="region"
      aria-label="Courses to compare"
    >
      <div className="wrap tray__inner">
        <span className="tray__label">
          <b>{compare.items.length}</b>{' '}
          {compare.items.length === 1 ? 'course' : 'courses'} to compare
          {compare.full ? ` (up to ${COMPARE_LIMIT})` : ''}
        </span>
        <div className="tray__items">
          {compare.items.map((entry) => (
            <span className="tray__item" key={entry.slug}>
              <span className="tray__itemname">{entry.name}</span>
              <button
                type="button"
                className="tray__remove"
                aria-label={`Remove ${entry.name} from comparison`}
                onClick={() => compare.remove(entry.slug)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="tray__actions">
          <button type="button" className="linkbtn" onClick={compare.clear}>
            Clear
          </button>
          <Link className="btn btn--sm btn--onnavy" href={compareHref(compare.items)}>
            Compare {compare.items.length}{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

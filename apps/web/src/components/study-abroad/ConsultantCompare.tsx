'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { COMPARE_LIMIT, compareHref } from '@/lib/record-compare';

/**
 * The consultant comparison shortlist: the "Compare" tick on each card, the
 * profile's "Add to comparison", and the navy tray along the foot of the
 * screen that opens /compare/consultants with what was ticked.
 *
 * The same arrangement as the course shortlist (CourseCompare), as the
 * client's build keeps it: a per-visitor convenience in local storage,
 * read through one store so every tick and the tray agree, kept between
 * the directory, a destination's or a city's consultants and a profile.
 * Up to three, the comparison's own limit. Storage can be missing or
 * refuse a write (a private window, blocked site data); the shortlist then
 * lasts as long as the page, and nothing breaks.
 */

export type ConsultantCompareItem = { slug: string; name: string };

const KEY = 'universta.compare.consultants';
const EMPTY: ConsultantCompareItem[] = [];

let items: ConsultantCompareItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/** Well-formed entries only, each consultant once, never more than three. */
export function tidyConsultantCompare(list: unknown[]): ConsultantCompareItem[] {
  const kept: ConsultantCompareItem[] = [];
  for (const entry of list) {
    const item = entry as ConsultantCompareItem;
    if (
      !entry ||
      typeof item.slug !== 'string' ||
      typeof item.name !== 'string' ||
      !item.slug ||
      kept.some((other) => other.slug === item.slug)
    )
      continue;
    kept.push({ slug: item.slug, name: item.name });
  }
  return kept.slice(0, COMPARE_LIMIT);
}

function parse(raw: string | null): ConsultantCompareItem[] {
  try {
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? tidyConsultantCompare(value) : EMPTY;
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

function write(next: ConsultantCompareItem[]) {
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

/** The shortlist as it stands, read from storage the first time. */
export function consultantCompareItems() {
  load();
  return items;
}

const current = consultantCompareItems;

/** Ticks a consultant on or off; a fourth is refused, not squeezed in. */
export function toggleConsultantCompare(item: ConsultantCompareItem) {
  const list = current();
  if (list.some((entry) => entry.slug === item.slug))
    write(list.filter((entry) => entry.slug !== item.slug));
  else if (list.length < COMPARE_LIMIT) write([...list, item]);
}

export function removeConsultantCompare(slug: string) {
  write(current().filter((entry) => entry.slug !== slug));
}

export function clearConsultantCompare() {
  write(EMPTY);
}

/**
 * Makes the shortlist the comparison on screen, in its order. Nothing is
 * written when the two already agree, so opening the same comparison twice
 * does not wake every tick on the page.
 */
export function adoptConsultantCompare(next: ConsultantCompareItem[]) {
  const list = tidyConsultantCompare(next);
  const now = current();
  const same = list.length === now.length && list.every((entry, index) => entry.slug === now[index]!.slug);
  if (!same) write(list);
}

const toggle = toggleConsultantCompare;
const remove = removeConsultantCompare;
const clear = clearConsultantCompare;

/* The server has no shortlist: the page renders unticked, and the browser's
   own list arrives as soon as it hydrates, without a mismatch. */
const serverSnapshot = () => EMPTY;

export function useConsultantCompare() {
  const list = useSyncExternalStore(subscribe, current, serverSnapshot);
  return {
    items: list,
    has: (slug: string) => list.some((entry) => entry.slug === slug),
    full: list.length >= COMPARE_LIMIT,
    toggle,
    remove,
    clear,
  };
}

/** The comparison of a shortlist, at the address the compare page reads. */
export function consultantCompareHref(list: readonly ConsultantCompareItem[]) {
  return compareHref(
    'consultants',
    list.map((entry) => entry.slug),
  );
}

/** The card's small "Compare" tick, as the design's consultant card has it. */
export function ConsultantCompareCheck({ item }: { item: ConsultantCompareItem }) {
  const compare = useConsultantCompare();
  const checked = compare.has(item.slug);
  return (
    <label
      className="tinycheck"
      title={!checked && compare.full ? `Up to ${COMPARE_LIMIT} consultants` : undefined}
    >
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

/** The profile's "Add to comparison", the hero's version of the same tick. */
export function ConsultantCompareButton({ item }: { item: ConsultantCompareItem }) {
  const compare = useConsultantCompare();
  const checked = compare.has(item.slug);
  return (
    <label
      className="iconbtn iconbtn--check"
      title={!checked && compare.full ? `Up to ${COMPARE_LIMIT} consultants` : undefined}
    >
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

/** The navy bar along the foot of the screen while anything is ticked. */
export function ConsultantCompareTray() {
  const compare = useConsultantCompare();
  if (!compare.items.length) return null;
  return (
    <div className="tray tray--consultants" data-open="true" role="region" aria-label="Consultants to compare">
      <div className="wrap tray__inner">
        <span className="tray__label">
          <b>{compare.items.length}</b> of {COMPARE_LIMIT} consultants selected
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
          <Link className="btn btn--sm btn--onnavy" href={consultantCompareHref(compare.items)}>
            Compare{' '}
            <span className="btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Brings the shortlist into line with the comparison on screen, so the tray
 * on every other page shows what was just compared. Only a comparison that
 * found something is adopted: a stale link whose consultants have all gone,
 * or an API that did not answer, leaves the visitor's list alone.
 */
export function ConsultantCompareSync({ items: shown }: { items: ConsultantCompareItem[] }) {
  const key = shown.map((entry) => `${entry.slug}:${entry.name}`).join('|');
  useEffect(() => {
    if (shown.length) adoptConsultantCompare(shown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the list's identity
  }, [key]);
  return null;
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  COMPARE_LIMIT,
  compareHref as slugsHref,
  type CompareOption,
} from '@/lib/course-compare';

/**
 * The course comparison shortlist, kept between every list of programmes,
 * each programme's page and the comparison itself.
 *
 * The behaviour reference keeps its compare bar in the browser, so a course
 * ticked on the list is still ticked on its own page and after a reload.
 * This is the same: a per-visitor convenience in local storage, read through
 * one store so every checkbox and the tray agree, and opened at
 * /compare/courses, which lines up to four programmes side by side. Opening
 * a comparison's address makes the shortlist match it, as the reference's
 * compare page rewrites its own list from the address.
 *
 * Storage can be missing or refuse a write (a private window, blocked site
 * data); the shortlist then lasts as long as the page, and nothing breaks.
 */

export { COMPARE_LIMIT };

export type CompareItem = { slug: string; name: string };

const KEY = 'universta.compare.courses';
const EMPTY: CompareItem[] = [];

let items: CompareItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

/** Well-formed entries only, each programme once, never more than four. */
function tidy(list: unknown[]): CompareItem[] {
  const kept: CompareItem[] = [];
  for (const entry of list) {
    const item = entry as CompareItem;
    if (
      !entry ||
      typeof item.slug !== 'string' ||
      typeof item.name !== 'string' ||
      kept.some((other) => other.slug === item.slug)
    )
      continue;
    kept.push({ slug: item.slug, name: item.name });
  }
  return kept.slice(0, COMPARE_LIMIT);
}

function parse(raw: string | null): CompareItem[] {
  try {
    const value = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(value) ? tidy(value) : EMPTY;
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

/** The shortlist as it stands, read from storage the first time. */
export function compareItems() {
  load();
  return items;
}

/** Ticks a programme on or off; a fifth is refused, not squeezed in. */
export function toggleCompare(item: CompareItem) {
  const list = compareItems();
  if (list.some((entry) => entry.slug === item.slug))
    write(list.filter((entry) => entry.slug !== item.slug));
  else if (list.length < COMPARE_LIMIT) write([...list, item]);
}

export function removeCompare(slug: string) {
  write(compareItems().filter((entry) => entry.slug !== slug));
}

export function clearCompare() {
  write(EMPTY);
}

/**
 * Makes the shortlist the comparison on screen: the programmes it found, in
 * its order. Nothing is written when the two already agree, so opening the
 * same comparison twice does not wake every checkbox on the page.
 */
export function adoptCompare(next: CompareItem[]) {
  const list = tidy(next);
  const current = compareItems();
  const same =
    list.length === current.length &&
    list.every((entry, index) => entry.slug === current[index]!.slug);
  if (!same) write(list);
}

/* The server has no shortlist: the page renders unticked, and the browser's
   own list arrives as soon as it hydrates, without a mismatch. */
const serverSnapshot = () => EMPTY;

export function useCourseCompare() {
  const list = useSyncExternalStore(subscribe, compareItems, serverSnapshot);
  const has = (slug: string) => list.some((entry) => entry.slug === slug);
  return {
    items: list,
    has,
    full: list.length >= COMPARE_LIMIT,
    toggle: toggleCompare,
    remove: removeCompare,
    clear: clearCompare,
    adopt: adoptCompare,
  };
}

export function compareHref(list: CompareItem[]) {
  return slugsHref(list.map((entry) => entry.slug));
}

/** The card's small "Compare" tick, as the design's course card has it. */
export function CompareCheck({ item }: { item: CompareItem }) {
  const compare = useCourseCompare();
  const checked = compare.has(item.slug);
  return (
    <label
      className="tinycheck"
      title={!checked && compare.full ? `Up to ${COMPARE_LIMIT} courses` : undefined}
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

/* ---------------------------------------------------------------------
   The comparison page's own controls. The page itself is drawn on the
   server from its address; these keep the shortlist in step with it.
   --------------------------------------------------------------------- */

/**
 * Brings the shortlist into line with the comparison on screen, so the
 * tray on every other page shows what was just compared. Only a comparison
 * that found something is adopted: a stale link whose programmes have all
 * gone, or an API that did not answer, leaves the visitor's list alone.
 */
export function CompareSync({ items: shown }: { items: CompareItem[] }) {
  useEffect(() => {
    if (shown.length) adoptCompare(shown);
  }, [shown]);
  return null;
}

/**
 * "Remove" under a column, and "Clear all": links to the same comparison
 * without the programme (or without any), which take it off the shortlist
 * on the way so the two never disagree, even for the moment before the
 * next page adopts its list.
 */
export function CompareRemoveLink({
  href,
  slug,
  className,
  label,
  children,
}: {
  href: string;
  /** The programme to take off, or null for all of them. */
  slug: string | null;
  className: string;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={className}
      href={href}
      rel="nofollow"
      aria-label={label}
      onClick={() => (slug ? removeCompare(slug) : clearCompare())}
    >
      {children}
    </Link>
  );
}

/**
 * The design's "Add a course…" list, with the search field the old chooser
 * had kept beside it: a catalogue of a thousand programmes is too long to
 * scroll, so typing narrows the list. Choosing one opens the comparison
 * with it added.
 */
const SHOWN_OPTIONS = 100;

export function CompareAddPicker({
  options,
  picked,
}: {
  options: CompareOption[];
  picked: string[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const full = picked.length >= COMPARE_LIMIT;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        !picked.includes(option.slug) &&
        (!needle ||
          option.label.toLowerCase().includes(needle) ||
          option.slug.includes(needle)),
    );
  }, [options, picked, query]);
  const shown = matches.slice(0, SHOWN_OPTIONS);

  return (
    <div className="comparepick">
      <label className="sr-only" htmlFor="compare-course-search">
        Search courses to add
      </label>
      <input
        id="compare-course-search"
        className="comparepick__search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search courses"
        disabled={full || !options.length}
      />
      <label className="sr-only" htmlFor="compare-course-add">
        Add a course to the comparison
      </label>
      <select
        id="compare-course-add"
        className="comparepick__select"
        value=""
        disabled={full || !options.length}
        onChange={(event) => {
          const slug = event.target.value;
          if (slug) router.push(slugsHref([...picked, slug]));
        }}
      >
        <option value="">
          {full
            ? `Up to ${COMPARE_LIMIT} courses. Remove one to add another.`
            : options.length
              ? query.trim()
                ? `Add a course… (${matches.length} found)`
                : 'Add a course…'
              : 'No courses to add yet'}
        </option>
        {shown.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
        {/* A value of its own: sharing the prompt's empty one, a browser
            showed this line as the list's current choice. */}
        {matches.length > shown.length ? (
          <option value="__more" disabled>
            {`… ${matches.length - shown.length} more: type to narrow the list`}
          </option>
        ) : null}
      </select>
      <CompareRemoveLink
        className="btn btn--ghost btn--sm"
        href="/compare/courses"
        slug={null}
      >
        Clear all
      </CompareRemoveLink>
    </div>
  );
}

/**
 * On the comparison's bare address, a shortlist already on this device is
 * offered rather than silently opened: "/compare/courses" with nothing
 * chosen still says nothing is chosen.
 */
export function StoredShortlist() {
  const compare = useCourseCompare();
  if (!compare.items.length) return null;
  const count = compare.items.length;
  return (
    <p className="sec-lead compare-stored">
      {count === 1 ? 'One course is' : `${count} courses are`} on your shortlist on
      this device.{' '}
      <Link href={compareHref(compare.items)}>
        {/* One string: the compiler drops the space before an entity that
            follows an expression. */}
        {`Compare ${count === 1 ? 'it' : 'them'} →`}
      </Link>
    </p>
  );
}

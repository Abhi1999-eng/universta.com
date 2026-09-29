/**
 * The few pages a visitor last opened, kept in their own browser.
 *
 * This is what the reference's "Continue your journey" strip is built from.
 * It never leaves the device and never reaches the API: it exists so someone
 * who comes back to the home page can pick up where they were, and that is
 * the whole of its purpose.
 *
 * Every read and write is guarded. `localStorage` throws in a private window
 * with site data blocked, and a page that cannot remember a visit should still
 * render -- the strip simply stands down.
 */

const KEY = 'universta:recent';
const LIMIT = 6;

export type RecentKind = 'subject' | 'specialization' | 'country' | 'course';

export type RecentVisit = {
  kind: RecentKind;
  /** What the strip links to. */
  href: string;
  /** The record's own name, shown as the card's title. */
  title: string;
  /** Epoch milliseconds, so the newest visit leads. */
  at: number;
};

const LABELS: Record<RecentKind, string> = {
  subject: 'Recently viewed subject',
  specialization: 'Recently viewed specialization',
  country: 'Recently viewed destination',
  course: 'Recently viewed course',
};

export function recentLabel(kind: RecentKind) {
  return LABELS[kind] ?? 'Recently viewed';
}

function isVisit(value: unknown): value is RecentVisit {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<RecentVisit>;
  return (
    typeof row.href === 'string' &&
    typeof row.title === 'string' &&
    typeof row.at === 'number' &&
    typeof row.kind === 'string' &&
    row.kind in LABELS &&
    /* Only our own paths: a stored absolute URL would turn this strip into an
       open redirect the moment anything else could write to that key. */
    row.href.startsWith('/') &&
    !row.href.startsWith('//')
  );
}

function parse(raw: string | null): RecentVisit[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const rows = parsed.filter(isVisit).sort((a, b) => b.at - a.at).slice(0, LIMIT);
    return rows.length ? rows : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** The server has no browser to read, so it renders as though there is no
 *  history -- which is also what a first-time visitor sees. */
const EMPTY: RecentVisit[] = [];
export function recentServerSnapshot(): RecentVisit[] {
  return EMPTY;
}

/* `useSyncExternalStore` compares snapshots by identity, so parsing on every
   read would re-render forever. The parsed list is cached against the raw
   string it came from and only rebuilt when that string changes. */
let cachedRaw: string | null = null;
let cachedList: RecentVisit[] = EMPTY;

export function recentSnapshot(): RecentVisit[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedList = parse(raw);
    }
    return cachedList;
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();

export function subscribeRecent(listener: () => void) {
  listeners.add(listener);
  /* Another tab writing the same key, so a visit made there shows here. */
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function readRecent(): RecentVisit[] {
  return recentSnapshot();
}

export function recordVisit(visit: Omit<RecentVisit, 'at'>) {
  if (!isVisit({ ...visit, at: Date.now() })) return;
  try {
    /* One entry per page: revisiting a subject moves it to the front rather
       than filling the strip with the same card. */
    const next = [
      { ...visit, at: Date.now() },
      ...readRecent().filter((row) => row.href !== visit.href),
    ].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(next));
    /* Same tab: the storage event does not fire for the writer, so anything
       showing the strip is told directly. */
    for (const listener of listeners) listener();
  } catch {
    /* Storage is full, blocked or unavailable. Nothing to do: the strip is a
       convenience, not part of the page's meaning. */
  }
}

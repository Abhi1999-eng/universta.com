import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The comparison shortlist every programme list, programme page and the
 * comparison share: kept in the browser, four at most, as both references
 * allow, and brought into line with a comparison's address when one is
 * opened. Storage that is missing or refuses a write costs the memory of
 * the list, never the page.
 */

const KEY = 'universta.compare.courses';

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
  return { storage, data };
}

/* The store reads storage once per page, so each test loads it afresh
   against its own window. */
async function loadStore(storage: Storage) {
  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.resetModules();
  return import('./CourseCompare');
}

const item = (n: number) => ({ slug: `uni-course-${n}`, name: `Course ${n} · Uni` });

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the comparison shortlist', () => {
  it('holds four programmes, and refuses a fifth rather than dropping one', async () => {
    const { storage, data } = fakeStorage();
    const store = await loadStore(storage);
    expect(store.COMPARE_LIMIT).toBe(4);
    for (const n of [1, 2, 3, 4, 5]) store.toggleCompare(item(n));
    expect(store.compareItems().map((entry) => entry.slug)).toEqual([
      'uni-course-1',
      'uni-course-2',
      'uni-course-3',
      'uni-course-4',
    ]);
    expect(JSON.parse(data.get(KEY)!)).toHaveLength(4);
    /* Unticking one makes room again. */
    store.toggleCompare(item(2));
    store.toggleCompare(item(5));
    expect(store.compareItems().map((entry) => entry.slug)).toContain('uni-course-5');
  });

  it('reads a stored list, dropping malformed entries and anything past four', async () => {
    const stored = [item(1), { slug: 7 }, item(2), item(2), item(3), item(4), item(5)];
    const { storage } = fakeStorage({ [KEY]: JSON.stringify(stored) });
    const store = await loadStore(storage);
    expect(store.compareItems().map((entry) => entry.slug)).toEqual([
      'uni-course-1',
      'uni-course-2',
      'uni-course-3',
      'uni-course-4',
    ]);
  });

  it('adopts a comparison’s programmes, once each and four at most', async () => {
    const { storage, data } = fakeStorage({ [KEY]: JSON.stringify([item(9)]) });
    const store = await loadStore(storage);
    store.adoptCompare([item(1), item(1), item(2), item(3), item(4), item(5)]);
    expect(store.compareItems().map((entry) => entry.slug)).toEqual([
      'uni-course-1',
      'uni-course-2',
      'uni-course-3',
      'uni-course-4',
    ]);
    expect(JSON.parse(data.get(KEY)!)).toEqual([item(1), item(2), item(3), item(4)]);
  });

  it('writes nothing when the comparison already matches the shortlist', async () => {
    const { storage } = fakeStorage({ [KEY]: JSON.stringify([item(1), item(2)]) });
    const store = await loadStore(storage);
    store.adoptCompare([item(1), item(2)]);
    expect(storage.setItem).not.toHaveBeenCalled();
    /* A different order is a different comparison. */
    store.adoptCompare([item(2), item(1)]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('keeps working in memory when storage cannot be read or written', async () => {
    const store = await loadStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(store.compareItems()).toEqual([]);
    store.toggleCompare(item(1));
    store.adoptCompare([item(2), item(3)]);
    expect(store.compareItems().map((entry) => entry.slug)).toEqual([
      'uni-course-2',
      'uni-course-3',
    ]);
    store.removeCompare('uni-course-2');
    expect(store.compareItems().map((entry) => entry.slug)).toEqual(['uni-course-3']);
    store.clearCompare();
    expect(store.compareItems()).toEqual([]);
  });

  it('survives a stored value that is not a list at all', async () => {
    const { storage } = fakeStorage({ [KEY]: '{"slug":"x"' });
    const store = await loadStore(storage);
    expect(store.compareItems()).toEqual([]);
  });

  it('opens the comparison at an address that names each programme', async () => {
    const { storage } = fakeStorage();
    const store = await loadStore(storage);
    expect(store.compareHref([item(1), item(2)])).toBe(
      '/compare/courses?items=uni-course-1,uni-course-2',
    );
    expect(store.compareHref([])).toBe('/compare/courses');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The consultant comparison shortlist: kept in the browser, three at most
 * (the comparison's own limit), shared by every card's tick, the profile's
 * "Add to comparison" and the tray, and brought into line with a
 * comparison when one is opened.
 */

const KEY = 'universta.compare.consultants';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    storage: {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        data.set(key, value);
      }),
    },
  };
}

async function loadStore(storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }) {
  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.resetModules();
  return import('./ConsultantCompare');
}

const item = (n: number) => ({ slug: `consultant-${n}`, name: `Consultant ${n}` });

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the consultant comparison shortlist', () => {
  it('holds three consultants, and refuses a fourth rather than dropping one', async () => {
    const { storage, data } = fakeStorage();
    const store = await loadStore(storage);
    for (const n of [1, 2, 3, 4]) store.toggleConsultantCompare(item(n));
    expect(store.consultantCompareItems().map((entry) => entry.slug)).toEqual([
      'consultant-1',
      'consultant-2',
      'consultant-3',
    ]);
    expect(JSON.parse(data.get(KEY)!)).toHaveLength(3);
  });

  it('unticks a consultant ticked twice, and clears', async () => {
    const store = await loadStore(fakeStorage().storage);
    store.toggleConsultantCompare(item(1));
    store.toggleConsultantCompare(item(2));
    store.toggleConsultantCompare(item(1));
    expect(store.consultantCompareItems().map((entry) => entry.slug)).toEqual(['consultant-2']);
    store.clearConsultantCompare();
    expect(store.consultantCompareItems()).toEqual([]);
  });

  it('reads what an earlier page kept, and ignores what it cannot read', async () => {
    const kept = await loadStore(
      fakeStorage({ [KEY]: JSON.stringify([item(1), { slug: 7 }, item(1), item(2)]) }).storage,
    );
    expect(kept.consultantCompareItems().map((entry) => entry.slug)).toEqual(['consultant-1', 'consultant-2']);
    const broken = await loadStore(fakeStorage({ [KEY]: '{not json' }).storage);
    expect(broken.consultantCompareItems()).toEqual([]);
  });

  it('keeps working when storage refuses a write', async () => {
    const store = await loadStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    store.toggleConsultantCompare(item(1));
    expect(store.consultantCompareItems().map((entry) => entry.slug)).toEqual(['consultant-1']);
  });

  it('becomes the comparison that was opened', async () => {
    const store = await loadStore(fakeStorage().storage);
    store.toggleConsultantCompare(item(1));
    store.adoptConsultantCompare([item(3), item(2)]);
    expect(store.consultantCompareItems().map((entry) => entry.slug)).toEqual(['consultant-3', 'consultant-2']);
  });

  it('opens /compare/consultants with what was ticked', async () => {
    const store = await loadStore(fakeStorage().storage);
    expect(store.consultantCompareHref([item(1), item(2)])).toBe(
      '/compare/consultants?items=consultant-1,consultant-2',
    );
  });

  it('renders the card tick and the hero toggle unticked on the server', async () => {
    const store = await loadStore(fakeStorage().storage);
    const tick = renderToStaticMarkup(<store.ConsultantCompareCheck item={item(1)} />);
    expect(tick).toContain('class="tinycheck"');
    expect(tick).toContain('aria-label="Compare Consultant 1"');
    expect(tick).not.toContain('checked=""');
    const hero = renderToStaticMarkup(<store.ConsultantCompareButton item={item(1)} />);
    expect(hero).toContain('Add to comparison');
    /* Nothing is ticked on the server, so no tray is drawn there. */
    expect(renderToStaticMarkup(<store.ConsultantCompareTray />)).toBe('');
  });
});

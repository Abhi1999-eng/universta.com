import { describe, expect, it, vi, beforeEach } from 'vitest';

const phaseList = vi.fn();
const getSubjects = vi.fn();

vi.mock('@/lib/phase1', () => ({ phaseList: (...args: unknown[]) => phaseList(...args) }));
vi.mock('@/lib/catalog', () => ({ getSubjects: (...args: unknown[]) => getSubjects(...args) }));

const { loadCountryTabs, tabCounts } = await import('./country-tabs');

const totals = (universities: number, scholarships: number) =>
  phaseList.mockImplementation((resource: string) =>
    Promise.resolve({
      data: [],
      meta: { total: resource === 'universities' ? universities : scholarships },
    }),
  );

beforeEach(() => {
  phaseList.mockReset();
  getSubjects.mockReset();
});

/**
 * The strip has to agree with the page it leads to.
 *
 * A destination with no subject links of its own shows the catalogue's, so
 * the guide was reporting none while the page one click away listed thirty
 * — and the tab that led there did not appear at all, because a count of
 * zero drops it.
 */
describe('the subject count on a destination’s tabs', () => {
  it('uses the destination’s own links when it has them', async () => {
    totals(192, 5);
    const tabs = await loadCountryTabs('united-kingdom', 12);
    expect(tabs.find((tab) => tab.key === 'subjects')?.count).toBe(12);
    expect(getSubjects).not.toHaveBeenCalled();
  });

  it('falls back to the catalogue when it has none, as the page does', async () => {
    totals(192, 5);
    getSubjects.mockResolvedValue({ data: [], meta: { total: 30 } });
    const tabs = await loadCountryTabs('united-kingdom', 0);
    expect(tabs.find((tab) => tab.key === 'subjects')?.count).toBe(30);
  });

  it('drops the tab when neither has anything', async () => {
    totals(192, 0);
    getSubjects.mockResolvedValue({ data: [], meta: { total: 0 } });
    const tabs = await loadCountryTabs('nowhere', 0);
    expect(tabs.map((tab) => tab.key)).toEqual(['overview', 'universities']);
  });

  it('counts a failed read as zero rather than NaN', async () => {
    phaseList.mockRejectedValue(new Error('down'));
    getSubjects.mockRejectedValue(new Error('down'));
    const tabs = await loadCountryTabs('united-kingdom', 0);
    expect(tabs.map((tab) => tab.key)).toEqual(['overview']);
  });
});

describe('the counts a page reads back out of the strip', () => {
  it('are the ones the tabs were built from', async () => {
    totals(12, 3);
    const tabs = await loadCountryTabs('uk', 30);
    expect(tabCounts(tabs)).toEqual({ universities: 12, scholarships: 3 });
  });

  it('are zero for a tab that is not shown, which is when a link should not be either', async () => {
    totals(0, 0);
    const tabs = await loadCountryTabs('uk', 30);
    expect(tabCounts(tabs)).toEqual({ universities: 0, scholarships: 0 });
  });
});

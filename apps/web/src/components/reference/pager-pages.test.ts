import { describe, expect, it } from 'vitest';
import { pagerPages } from './pager-pages';

/**
 * /universities has 32 pages. Four of the six directories drew every one of
 * them as a numbered button: three rows, 178px tall, under the results — and
 * a catalogue twice the size would be six rows.
 */

const numbers = (current: number, total: number) =>
  pagerPages(current, total).map((item) => item.page);

const withGaps = (current: number, total: number) =>
  pagerPages(current, total)
    .map((item) => (item.gapBefore ? `… ${item.page}` : String(item.page)))
    .join(' ');

describe('which pages a pager draws', () => {
  it('keeps the first, the last and the ones either side of here', () => {
    expect(numbers(16, 32)).toEqual([1, 15, 16, 17, 32]);
  });

  it('marks the gap where a run was left out', () => {
    expect(withGaps(16, 32)).toBe('1 … 15 16 17 … 32');
  });

  it('draws no gap where the run is unbroken', () => {
    expect(withGaps(2, 4)).toBe('1 2 3 4');
  });

  it('does not run off either end', () => {
    expect(withGaps(1, 32)).toBe('1 2 … 32');
    expect(withGaps(32, 32)).toBe('1 … 31 32');
  });

  it('handles a page near, but not at, the end', () => {
    expect(withGaps(31, 32)).toBe('1 … 30 31 32');
  });

  it('draws every page when they all fit anyway', () => {
    expect(numbers(1, 1)).toEqual([1]);
    expect(numbers(2, 3)).toEqual([1, 2, 3]);
  });

  it('never repeats a page', () => {
    for (let current = 1; current <= 32; current += 1) {
      const pages = numbers(current, 32);
      expect(new Set(pages).size).toBe(pages.length);
    }
  });

  it('stays under a dozen buttons however large the catalogue gets', () => {
    expect(numbers(500, 1000).length).toBeLessThanOrEqual(12);
  });
});

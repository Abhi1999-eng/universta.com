import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber } from './format';

/** The production symptom these prevent: /study-in-{country} logged React
 * hydration error #418 at every viewport, because the server rendered
 * "verified Jul 26, 2026" in UTC while a browser west of Greenwich rendered
 * "Jul 25, 2026" for the very same instant. */

describe('formatDate', () => {
  it('renders the UTC calendar date regardless of the ambient time zone', () => {
    // 02:00 UTC is still the previous day in the Americas. Pinning to UTC is
    // what makes the server and client agree.
    expect(formatDate('2026-07-26T02:00:00.000Z')).toBe('Jul 26, 2026');
  });

  it('does not drift for an instant late in the UTC day', () => {
    expect(formatDate('2026-07-26T23:30:00.000Z')).toBe('Jul 26, 2026');
  });

  it('accepts a Date as well as a string', () => {
    expect(formatDate(new Date('2026-01-05T12:00:00.000Z'))).toBe('Jan 5, 2026');
  });

  it('returns an empty string rather than "Invalid Date" for bad input', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });
});

describe('formatNumber', () => {
  it('groups thousands the same way on every host locale', () => {
    expect(formatNumber(42000)).toBe('42,000');
    expect(formatNumber(1200)).toBe('1,200');
  });

  it('accepts numeric strings, as the API returns decimals as strings', () => {
    expect(formatNumber('18000')).toBe('18,000');
  });

  it('returns an empty string rather than "NaN" for a missing figure', () => {
    expect(formatNumber(null)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber('')).toBe('');
    expect(formatNumber('not-a-number')).toBe('');
  });

  it('handles zero as a real value, not as absent', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

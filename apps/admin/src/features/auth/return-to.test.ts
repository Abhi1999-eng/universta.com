import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

describe('safe return paths', () => {
  it('preserves internal admin paths', () => {
    expect(safeReturnTo('/dashboard?tab=workspace')).toBe('/dashboard?tab=workspace');
  });

  it.each(['https://example.com', '//example.com', 'javascript:alert(1)', '/login', '%2F%2Fexample.com', '/\\evil'])('rejects unsafe return path %s', (value) => {
    expect(safeReturnTo(value)).toBe('/dashboard');
  });
});

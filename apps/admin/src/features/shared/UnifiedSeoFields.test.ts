import { describe, expect, it } from 'vitest';
import { canonicalInputError } from './UnifiedSeoFields';

describe('canonicalInputError', () => {
  it.each(['/countries/qa-country', 'https://example.com/countries/qa-country', 'http://example.com/countries/qa-country', ''])('accepts supported canonical input %s', (value) => {
    expect(canonicalInputError(value)).toBeNull();
  });

  it.each(['abc xyz', 'javascript:alert(1)', 'data:text/plain,test', '//evil.example/path', 'https://example.com/a b', '/countries/a b'])('rejects unsupported canonical input %s', (value) => {
    expect(canonicalInputError(value)).toContain('site path');
  });
});

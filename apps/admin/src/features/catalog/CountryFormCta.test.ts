import { describe, expect, it } from 'vitest';
import { ctaUrlInputError } from './CountryForm';

/**
 * Mirrors `ConsultantCardDto.ctaUrl` on the API
 * (`/^(?:\/(?!\/)|#[a-zA-Z0-9_-]+|https:\/\/)/`). A malformed CTA used to pass
 * the browser untouched and come back as a bare "Invalid catalog request",
 * naming no field.
 */
describe('ctaUrlInputError', () => {
  it('accepts the forms the API accepts', () => {
    for (const value of [
      '/counselling',
      '/study-abroad-consultants',
      '#consultation',
      'https://example.com/advisors',
      '',
    ])
      expect(ctaUrlInputError(value)).toBeNull();
  });

  it('rejects malformed and unsafe values', () => {
    for (const value of [
      'not a url at all',
      'javascript:alert(1)',
      'data:text/html,hi',
      '//evil.example/path',
      'http://example.com/insecure',
      'counselling',
    ])
      expect(ctaUrlInputError(value)).toContain('site path');
  });

  it('treats a blank CTA as nothing to validate', () => {
    expect(ctaUrlInputError('   ')).toBeNull();
  });
});

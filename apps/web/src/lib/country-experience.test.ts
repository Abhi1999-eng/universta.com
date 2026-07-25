import { describe, expect, it } from 'vitest';
import { consultationTarget, isPublishedValue } from './country-experience';

describe('country experience fallbacks', () => {
  it('selects only real consultation destinations', () => {
    expect(consultationTarget({ hasConsultants: true, hasStructuredTrust: false })).toBe('#consultants');
    expect(consultationTarget({ hasConsultants: false, hasStructuredTrust: true })).toBe('#structured-trust');
    expect(consultationTarget({ hasConsultants: false, hasStructuredTrust: false, configuredDestination: '/contact' })).toBe('/contact');
    expect(consultationTarget({ hasConsultants: false, hasStructuredTrust: false })).toBeNull();
  });

  it('preserves explicit zero while omitting null and empty values', () => {
    expect(isPublishedValue(0)).toBe(true);
    expect(isPublishedValue('0')).toBe(true);
    expect(isPublishedValue(null)).toBe(false);
    expect(isPublishedValue(undefined)).toBe(false);
    expect(isPublishedValue('')).toBe(false);
  });
});

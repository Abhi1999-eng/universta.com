import { describe, expect, it, vi } from 'vitest';
import { fieldHelpRegistry, getFieldHelp } from './registry';

describe('fieldHelpRegistry / getFieldHelp', () => {
  it('returns the registered content for a known key', () => {
    const content = getFieldHelp('universities.slug');
    expect(content).toBeDefined();
    expect(content?.purpose).toContain('URL-friendly identifier');
    expect(content?.dataType).toBe('Text');
  });

  it('returns undefined for a missing key without throwing', () => {
    expect(() => getFieldHelp('not-a-real.key')).not.toThrow();
    expect(getFieldHelp('not-a-real.key')).toBeUndefined();
  });

  it('warns in development when a key is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getFieldHelp('another-missing.key');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('another-missing.key'));
    warnSpy.mockRestore();
  });

  it('does not warn for a key that resolves', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    getFieldHelp('scholarships.amount');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('gives every entry at minimum a purpose, dataType and required statement', () => {
    for (const [key, content] of Object.entries(fieldHelpRegistry)) {
      expect(content.purpose, `${key} is missing purpose`).toBeTruthy();
      expect(content.dataType, `${key} is missing dataType`).toBeTruthy();
      expect(content.required, `${key} is missing required`).toBeTruthy();
    }
  });
});

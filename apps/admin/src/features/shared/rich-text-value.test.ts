import { describe, expect, it } from 'vitest';
import { richTextOrEmpty } from './rich-text-value';
import { richTextOrEmpty as fromCountryForm } from '@/features/catalog/CountryForm';

/**
 * An emptied rich text editor keeps its empty paragraph. The level-page
 * editor hides an empty intro or note on the site, so "<p><br></p>" has to
 * reach the API as nothing, as it already did for the Country editor.
 */
describe('richTextOrEmpty', () => {
  it('sends an emptied editor as nothing', () => {
    expect(richTextOrEmpty('<p><br></p>')).toBe('');
    expect(richTextOrEmpty('<p>&nbsp;</p>')).toBe('');
    expect(richTextOrEmpty('<p> </p><p><br></p>')).toBe('');
    expect(richTextOrEmpty('')).toBe('');
  });

  it('keeps text with words in it, trimmed', () => {
    expect(richTextOrEmpty('  <p>Three years, full time.</p>\n')).toBe('<p>Three years, full time.</p>');
  });

  it('is the same function the Country editor exports', () => {
    expect(fromCountryForm).toBe(richTextOrEmpty);
  });
});

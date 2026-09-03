import { sanitizeRichText } from '../../common/rich-text';

/**
 * A guidance card's `overview` is prose, like a FAQ answer, and is stored on
 * the same sanitised rich-text terms. It used to be validated as a plain-text
 * label, so a card carrying `<p>...</p>` failed with "Editorial section content
 * is invalid" and the whole card was discarded on save.
 *
 * The card's short fields -- title, slug, short description, CTA label -- are
 * labels and keep the plain-text guard, so they are deliberately not covered
 * by this policy.
 */
describe('consultant card overview copy policy', () => {
  it('keeps the editorial subset a card overview is written in', () => {
    const overview = '<p>QA card <strong>overview</strong>.</p>';
    expect(sanitizeRichText(overview)).toBe(overview);
  });

  it('keeps lists and safe links in a card overview', () => {
    const result = sanitizeRichText(
      '<ul><li>Guidance</li></ul><a href="/counselling">Book</a>',
    ) as string;
    expect(result).toContain('<li>Guidance</li>');
    expect(result).toContain('href="/counselling"');
  });

  it('strips scripts, handlers and unsafe schemes from a card overview', () => {
    const result = sanitizeRichText(
      '<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    ) as string;
    expect(result).toContain('Safe');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert(1)');
    expect(result).not.toContain('javascript:');
  });

  it('leaves a plain-text overview untouched', () => {
    expect(sanitizeRichText('QA card overview as plain text.')).toBe(
      'QA card overview as plain text.',
    );
  });
});

import { sanitizeRichText } from '../../common/rich-text';

/**
 * A FAQ answer is public-facing prose, rendered through the same sanitised
 * rich-text policy as an Editorial Section paragraph. It used to be validated
 * as a plain-text "copy" field, which blanket-rejected any markup -- so the
 * editorial HTML already stored against ten published Countries could never be
 * saved again, and any unrelated edit to those Countries failed with it.
 *
 * These cases pin the contract the save path now applies to `answer`. The
 * question and category stay plain text and keep their own guard.
 */
describe('country FAQ answer copy policy', () => {
  it('round-trips the editorial markup already stored in production', () => {
    // Verbatim from the published Poland FAQ that blocked every save.
    const stored =
      '<p>The cost profile contains illustrative demo ranges only. Tuition, accommodation and personal costs vary by programme and city.</p>';
    expect(sanitizeRichText(stored)).toBe(stored);
  });

  it('keeps the editorial subset an answer is written in', () => {
    const answer =
      '<p>Plan for <strong>tuition</strong> and <em>living costs</em>.</p><ul><li>Housing</li></ul><a href="/countries/poland">Poland</a>';
    const result = sanitizeRichText(answer) as string;
    expect(result).toContain('<strong>tuition</strong>');
    expect(result).toContain('<li>Housing</li>');
    expect(result).toContain('href="/countries/poland"');
  });

  it('strips scripts, event handlers and unsafe schemes from an answer', () => {
    const result = sanitizeRichText(
      '<p onclick="steal()">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><iframe src="https://evil.test"></iframe>',
    ) as string;
    expect(result).toContain('Safe');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert(1)');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('evil.test');
  });

  it('leaves a plain-text answer untouched', () => {
    expect(sanitizeRichText('Yes, the acceptance answer.')).toBe(
      'Yes, the acceptance answer.',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { leadAndRest } from './DocumentChecklist';

/** On a phone, ten documents at three paragraphs each ran to nearly six
 * screens. The row keeps the paragraph that says what the document is; the
 * advice after it moves behind a disclosure. */
describe('leadAndRest', () => {
  it('keeps the first paragraph and moves the rest behind the disclosure', () => {
    expect(leadAndRest('<p>What it is.</p><p>Advice one.</p><p>Advice two.</p>')).toEqual({
      lead: '<p>What it is.</p>',
      rest: '<p>Advice one.</p><p>Advice two.</p>',
    });
  });

  it('has nothing to disclose for a single paragraph', () => {
    expect(leadAndRest('<p>Only this.</p>')).toEqual({ lead: '<p>Only this.</p>', rest: null });
  });

  it('ignores an empty paragraph an editor leaves behind', () => {
    expect(leadAndRest('<p>Only this.</p><p><br></p>').rest).toBeNull();
  });

  it('leaves plain text whole', () => {
    expect(leadAndRest('Plain text without paragraphs.')).toEqual({
      lead: 'Plain text without paragraphs.',
      rest: null,
    });
  });
});

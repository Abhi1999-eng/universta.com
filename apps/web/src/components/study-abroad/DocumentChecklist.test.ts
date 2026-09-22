import { describe, expect, it } from 'vitest';
import { leadAndRest } from './DocumentChecklist';

/** Ten documents at three paragraphs each ran to nearly six screens on a
 * phone. Each row keeps the sentence that says what the document is; the
 * rest moves behind a disclosure. */
describe('leadAndRest', () => {
  it('keeps the first sentence and moves the rest behind the disclosure', () => {
    expect(
      leadAndRest(
        '<p>A passport is the document everything hangs on. Check its expiry.</p><p>Bring the original.</p>',
      ),
    ).toEqual({
      lead: '<p>A passport is the document everything hangs on.</p>',
      rest: '<p>Check its expiry.</p><p>Bring the original.</p>',
    });
  });

  it('has nothing to disclose for a single sentence', () => {
    expect(leadAndRest('<p>Only this one sentence.</p>')).toEqual({
      lead: '<p>Only this one sentence.</p>',
      rest: null,
    });
  });

  it('ignores an empty paragraph an editor leaves behind', () => {
    expect(leadAndRest('<p>Only this one sentence.</p><p><br></p>').rest).toBeNull();
  });

  it('splits plain text the same way', () => {
    expect(leadAndRest('Plain text without any markup. A second sentence.')).toEqual({
      lead: '<p>Plain text without any markup.</p>',
      rest: '<p>A second sentence.</p>',
    });
  });

  it('keeps entities intact rather than escaping them twice', () => {
    expect(leadAndRest('<p>Scores are compared like this. Band 6 &lt; band 7.</p>').rest).toBe(
      '<p>Band 6 &lt; band 7.</p>',
    );
  });
});

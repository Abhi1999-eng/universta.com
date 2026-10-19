import { describe, expect, it } from 'vitest';
import { excerpt, plainExcerpt, plainText } from './record-text';

describe('plainText', () => {
  it('strips the editor tags and reads entities back as characters', () => {
    expect(plainText('<p>Fees &amp; funding</p><p>Visas&nbsp;too</p>')).toBe('Fees & funding Visas too');
  });

  it('says nothing for an empty editor', () => {
    expect(plainText('<p><br></p>')).toBeNull();
    expect(plainText('   ')).toBeNull();
    expect(plainText(null)).toBeNull();
  });

  it('fills in the content variables the field offers', () => {
    expect(plainText('<p>{eventTitle} at {eventVenue}</p>', 'event', { title: 'Open day', venue: 'Hall A' })).toBe('Open day at Hall A');
  });
});

describe('excerpt', () => {
  it('returns text that fits whole', () => {
    expect(excerpt('Short.', 155)).toBe('Short.');
  });

  it('cuts at a word near the limit and closes with an ellipsis', () => {
    const cut = excerpt('one two three four five six seven eight nine ten', 20);
    expect(cut).toBe('one two three four…');
    expect(cut.length).toBeLessThanOrEqual(20);
  });

  it('cuts plain text in one step', () => {
    expect(plainExcerpt('<p>alpha beta gamma delta</p>', 12)).toBe('alpha beta…');
  });
});

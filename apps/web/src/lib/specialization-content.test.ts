import { describe, expect, it } from 'vitest';
import { namedParagraphs } from './specialization-content';

describe('namedParagraphs', () => {
  it('reads a section written place by place as one card per place', () => {
    expect(
      namedParagraphs([
        '<p><strong>United Kingdom</strong>: Three-year bachelor&#x27;s degrees.</p>',
        '<p><strong>Canada:</strong> Four years, often with co-op.</p>',
      ]),
    ).toEqual([
      { name: 'United Kingdom', line: 'Three-year bachelor&#x27;s degrees.' },
      { name: 'Canada', line: 'Four years, often with co-op.' },
    ]);
  });

  it('leaves prose alone when any paragraph is not named, or there is only one', () => {
    expect(namedParagraphs(['<p><strong>Japan</strong>: April starts.</p>', '<p>Plain text.</p>'])).toBeNull();
    expect(namedParagraphs(['<p><strong>Japan</strong>: April starts.</p>'])).toBeNull();
    expect(namedParagraphs(['<p>Study <strong>machine learning</strong>: models.</p>', '<p>More.</p>'])).toBeNull();
  });

  it('does not make a card with nothing in it', () => {
    expect(namedParagraphs(['<p><strong>Germany</strong>: </p>', '<p><strong>Japan</strong>: April.</p>'])).toBeNull();
  });
});

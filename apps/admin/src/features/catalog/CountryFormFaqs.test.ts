import { describe, expect, it } from 'vitest';
import { faqRowChanged, type FaqRow } from './CountryForm';

const stored: FaqRow = {
  id: 'faq-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  question: 'What costs should I plan for?',
  // Existing production answers carry editorial markup.
  answer: '<p>The cost profile contains illustrative demo ranges only.</p>',
  category: 'Costs',
  isFeatured: false,
  status: 'ACTIVE',
  displayOrder: '0',
};

describe('faqRowChanged', () => {
  it('leaves an untouched row alone, markup and all', () => {
    expect(faqRowChanged({ ...stored }, stored)).toBe(false);
  });

  it('sends a row the operator actually edited', () => {
    for (const patch of [
      { question: 'Changed?' },
      { answer: '<p>Rewritten.</p>' },
      { category: 'Visas' },
      { isFeatured: true },
      { status: 'DRAFT' },
      { displayOrder: '2' },
    ] as Array<Partial<FaqRow>>)
      expect(faqRowChanged({ ...stored, ...patch }, stored)).toBe(true);
  });

  it('always sends a row that has never been saved', () => {
    const unsaved: FaqRow = { ...stored, id: undefined, updatedAt: undefined };
    expect(faqRowChanged(unsaved, undefined)).toBe(true);
  });

  it('sends a saved row whose server copy is unknown rather than assuming it matches', () => {
    expect(faqRowChanged(stored, undefined)).toBe(true);
  });
});

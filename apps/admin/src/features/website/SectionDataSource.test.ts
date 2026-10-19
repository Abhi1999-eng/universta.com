import { describe, expect, it } from 'vitest';
import { pickOptions } from './SectionDataSource';

describe('records offered for a manual pick', () => {
  /* T-M2. Testimonials have no slug, so the list dropped every one of them
     and a Testimonials section could not be curated at all. */
  it('offers testimonials by id, named by their quote and who said it', () => {
    expect(
      pickOptions('TESTIMONIALS', [
        { id: 't-1', quote: 'They answered every question.', attribution: 'Asha' },
        { id: 't-2', quote: 'Clear and kind.', attribution: null },
      ]),
    ).toEqual([
      { slug: 't-1', name: 'They answered every question. — Asha' },
      { slug: 't-2', name: 'Clear and kind.' },
    ]);
  });

  it('keeps offering other records by slug', () => {
    expect(
      pickOptions('SUCCESS_STORIES', [
        { id: 's-1', slug: 'from-pune', title: 'From Pune' },
        { id: 's-2', title: 'No slug yet' },
      ]),
    ).toEqual([{ slug: 'from-pune', name: 'From Pune' }]);
  });
});

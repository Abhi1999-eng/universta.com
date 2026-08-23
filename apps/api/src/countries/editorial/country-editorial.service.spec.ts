import { BadRequestException } from '@nestjs/common';
import { validateEditorialBody } from './country-editorial.service';

describe('country editorial body policy', () => {
  it('accepts bounded typed section bodies', () => {
    expect(() =>
      validateEditorialBody('RICH_TEXT', {
        paragraphs: ['A sourced paragraph'],
      }),
    ).not.toThrow();
    expect(() =>
      validateEditorialBody('FACT_GRID', {
        items: [{ label: 'Intake', value: 'September' }],
      }),
    ).not.toThrow();
  });

  it('rejects arbitrary keys and oversized collections', () => {
    expect(() =>
      validateEditorialBody('RICH_TEXT', { html: '<script>bad</script>' }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateEditorialBody('FACT_GRID', {
        items: Array.from({ length: 13 }, () => ({ label: 'x' })),
      }),
    ).toThrow(BadRequestException);
  });

  it('supports the complete approved section key set with bounded bodies', () => {
    const keys = [
      'hero',
      'why-study',
      'universities',
      'subjects',
      'intakes',
      'documents',
      'cost-of-study',
      'scholarships',
      'visa-process',
      'work-opportunities',
      'language-requirements',
      'events',
      'cities',
      'life-and-culture',
      'living-costs',
      'careers',
      'application-steps',
      'guides',
      'faqs',
      'consultant-cta',
      'trust-disclaimer',
    ];
    expect(keys).toHaveLength(21);
    for (const key of keys) {
      expect(() =>
        validateEditorialBody('RICH_TEXT', { paragraphs: [key] }),
      ).not.toThrow();
    }
  });

  it('allows the shared editor HTML subset but rejects unsafe URLs and unapproved item fields', () => {
    expect(() =>
      validateEditorialBody('RICH_TEXT', {
        paragraphs: ['<p><strong>Allowed</strong></p>'],
      }),
    ).not.toThrow();
    expect(() =>
      validateEditorialBody('CARD_GRID', {
        items: [{ title: 'Card', description: 'Text', date: '2026-01-01' }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateEditorialBody('CARD_GRID', {
        items: [{ title: 'Card', ctaUrl: 'javascript:alert(1)' }],
      }),
    ).toThrow(BadRequestException);
  });
});

import { BadRequestException } from '@nestjs/common';
import { validateEditorialBody } from './country-editorial.service';

describe('country editorial body policy', () => {
  it('accepts bounded typed section bodies', () => {
    expect(() => validateEditorialBody('RICH_TEXT', { paragraphs: ['A sourced paragraph'] })).not.toThrow();
    expect(() => validateEditorialBody('FACT_GRID', { items: [{ label: 'Intake', value: 'September' }] })).not.toThrow();
  });

  it('rejects arbitrary keys and oversized collections', () => {
    expect(() => validateEditorialBody('RICH_TEXT', { html: '<script>bad</script>' })).toThrow(BadRequestException);
    expect(() => validateEditorialBody('FACT_GRID', { items: Array.from({ length: 13 }, () => ({ label: 'x' })) })).toThrow(BadRequestException);
  });
});

import { describe, expect, it } from 'vitest';
import { counsellingHref } from './counselling-link';

describe('counsellingHref', () => {
  it('keeps only safe slug and path source context', () => {
    expect(
      counsellingHref({
        source: 'country',
        country: 'canada',
        from: '/countries/canada',
      }),
    ).toBe(
      '/counselling?source=country&country=canada&from=%2Fcountries%2Fcanada',
    );
    expect(
      counsellingHref({
        source: 'course',
        course: 'unsafe<script>',
        from: '//external.example',
      }),
    ).toBe('/counselling?source=course');
  });
});

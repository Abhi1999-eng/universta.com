import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Country } from '@/lib/countries';
import { CountrySubjects } from './CountryLinkSections';

/**
 * A subject reaches a destination's page one of two ways and they are not
 * the same claim. Derived: a published course in it is taught there, so
 * opening it shows something. Editorial: somebody added it, usually for a
 * market the catalogue has not caught up with, and it may still be empty.
 *
 * In one undifferentiated grid, a reader clicks the second kind and lands
 * on nothing.
 */

const country = (
  subjects: Array<{ name: string; source?: string }>,
): Country =>
  ({
    id: 'c1',
    name: 'Germany',
    slug: 'germany',
    subjects: subjects.map((row, index) => ({
      id: `s${index}`,
      name: row.name,
      slug: row.name.toLowerCase().replace(/\s+/g, '-'),
      ...(row.source ? { source: row.source } : {}),
    })),
  }) as unknown as Country;

const render = (subjects: Array<{ name: string; source?: string }>) =>
  renderToStaticMarkup(
    <CountrySubjects country={country(subjects)} alt={false} />,
  );

describe('a destination’s subjects', () => {
  it('leads with the ones a course is actually taught under', () => {
    const html = render([
      { name: 'Hydrology', source: 'EDITORIAL' },
      { name: 'Engineering', source: 'DERIVED' },
    ]);
    expect(html.indexOf('Engineering')).toBeLessThan(html.indexOf('Hydrology'));
  });

  it('names the ones with nothing behind them, rather than hiding the difference', () => {
    const html = render([
      { name: 'Engineering', source: 'DERIVED' },
      { name: 'Hydrology', source: 'EDITORIAL' },
    ]);
    expect(html).toContain('no programme in the catalogue yet');
  });

  it('says nothing extra when every subject is taught', () => {
    const html = render([
      { name: 'Engineering', source: 'DERIVED' },
      { name: 'Computing', source: 'DERIVED' },
    ]);
    expect(html).not.toContain('no programme in the catalogue yet');
    expect(html).toContain('Engineering');
    expect(html).toContain('Computing');
  });

  it('is honest when a destination has only listed fields', () => {
    const html = render([{ name: 'Hydrology', source: 'EDITORIAL' }]);
    expect(html).toContain('The catalogue has no programmes under them yet');
    expect(html).toContain('Hydrology');
  });

  it('treats a link with no source as taught, not as listed', () => {
    /* Rows written before the column existed, and anything the API does
       not mark. Calling them editorial would wrongly demote them. */
    const html = render([{ name: 'Engineering' }]);
    expect(html).not.toContain('no programme in the catalogue yet');
  });

  it('stands down entirely when there are no subjects', () => {
    expect(render([])).toBe('');
  });
});

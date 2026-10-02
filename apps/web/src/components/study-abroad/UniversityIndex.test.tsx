import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  UniversityIndex,
  type UniversityIndexRow,
} from './UniversityIndex';

/**
 * The approved build's university directory filters in the browser over the
 * whole catalogue and has no pager, so this one loads every published
 * institution and does the same. What the card shows is what the catalogue
 * holds: the reference's profile-fit badge is scored against a student
 * profile this product does not collect, and its tuition and language
 * figures are recorded per offering here, not per institution.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const row = (over: Partial<UniversityIndexRow> = {}): UniversityIndexRow => ({
  id: 'u1',
  name: 'Aalborg University',
  slug: 'aalborg-university',
  shortDescription: 'Known for problem-based learning.',
  institutionType: 'PUBLIC',
  qsRanking: null,
  programmes: 3,
  campuses: 1,
  country: { name: 'Denmark', slug: 'denmark', iso2Code: 'DK' },
  ...over,
});

const render = (rows: UniversityIndexRow[]) =>
  renderToStaticMarkup(<UniversityIndex universities={rows} />);

describe('the university directory', () => {
  it('draws a card for every institution, with no pager', () => {
    const html = render([row(), row({ id: 'u2', name: 'Aalto', slug: 'aalto' })]);
    expect((html.match(/class="unicard"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('class="pager"');
  });

  it('counts what is on screen', () => {
    expect(render([row(), row({ id: 'u2' })])).toContain('2 universities');
    expect(render([row()])).toContain('1 university');
  });

  it('builds the destination filter from the catalogue, with counts', () => {
    const html = render([
      row(),
      row({ id: 'u2', country: { name: 'Finland', slug: 'finland', iso2Code: 'FI' } }),
      row({ id: 'u3' }),
    ]);
    /* Denmark twice, Finland once, most first. */
    expect(html.indexOf('Denmark')).toBeLessThan(html.indexOf('Finland'));
    expect(html).toContain('<em>2</em>');
    expect(html).toContain('<em>1</em>');
  });

  it('offers an institution-type filter only when there is more than one type', () => {
    expect(render([row(), row({ id: 'u2' })])).not.toContain('Institution type');
    expect(
      render([row(), row({ id: 'u2', institutionType: 'PRIVATE' })]),
    ).toContain('Institution type');
  });

  it('draws each country’s own flag on the card', () => {
    expect(render([row()])).toContain('/flags/dk.svg');
  });

  it('shows a ranking only where there is one', () => {
    expect(render([row()])).not.toContain('Ranked #');
    expect(render([row({ qsRanking: 412 })])).toContain('Ranked #412');
  });

  it('reads an institution type back as words, not as a database value', () => {
    expect(render([row({ institutionType: 'PRIVATE_NON_PROFIT' })])).toContain(
      'Private Non Profit',
    );
  });

  it('says so plainly when the catalogue is empty', () => {
    /* Not "no match" -- there is nothing to match against. */
    expect(render([])).toContain('No university is published yet');
  });
});

/**
 * Found by emptying the production catalogue and looking at the page.
 *
 * Both filter groups are built from the catalogue, so an empty one offers
 * nothing to narrow by — and the panel rendered anyway, a titled box framing
 * the absence of its own contents. The empty message, meanwhile, told a
 * reader to clear a filter they had not set.
 */
describe('the directory with nothing in it', () => {
  it('stands the filter panel down when there is nothing to narrow by', () => {
    const html = render([]);
    expect(html).not.toContain('filters-panel');
    expect(html).not.toContain('filters-toggle');
  });

  it('says what is actually true of an empty catalogue', () => {
    const html = render([]);
    expect(html).toContain('No university is published yet');
    expect(html).not.toContain('Clear a filter');
  });

  it('keeps the panel the moment there is one destination to offer', () => {
    expect(render([row()])).toContain('filters-panel');
  });

  it('does not offer to clear a filter nobody has set', () => {
    /* A catalogue with rows, no filter, no search: the reader has nothing
       to undo, so they are not told to undo anything. */
    const html = render([row({ name: 'Aalto' })]);
    expect(html).not.toContain('Clear a filter');
  });
});

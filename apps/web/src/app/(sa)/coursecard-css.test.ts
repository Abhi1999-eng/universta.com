import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The programme card's own rules, wherever the card is drawn.
 *
 * The card shows on /courses and a university's course list, and also on
 * subject, specialization, level and destination pages. Those pages load
 * study-abroad.css through the (sa) layout but not courses-zip.css, which
 * only the course pages import. With the fee's rule in courses-zip.css, a
 * destination page split "JPY 535,800" inside the number ("JPY 535,8" over
 * "00/yr"), and a programme's picture would have been drawn unstyled.
 *
 * These are CSS rules, not component state, so they are asserted against
 * the stylesheets.
 */
const dir = join(process.cwd(), 'src/app/(sa)');
const shared = readFileSync(join(dir, 'study-abroad.css'), 'utf8');
const coursePages = readFileSync(join(dir, 'courses-zip.css'), 'utf8');

/** The declarations of the first rule for one selector outside a media query. */
function block(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector}{`);
  expect(at, `expected a rule for \`${selector}\``).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('the programme card stylesheet', () => {
  it('keeps the fee whole in the stylesheet every page with the card loads', () => {
    expect(block(shared, '.sa .coursecard__amount')).toMatch(/white-space:\s*nowrap/);
    expect(block(shared, '.sa .coursecard__per')).toMatch(/white-space:\s*nowrap/);
  });

  it('clamps a long type line and sizes the picture there too', () => {
    expect(block(shared, '.sa .coursecard__type--long')).toMatch(/text-overflow:\s*ellipsis/);
    expect(block(shared, '.sa .coursecard__media')).toMatch(/aspect-ratio/);
  });

  it('leaves none of the card’s rules only in the course pages’ stylesheet', () => {
    expect(coursePages).not.toMatch(/\.coursecard__(amount|per|type--long|media)\b/);
  });
});

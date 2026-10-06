import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The site search's result grid, on a phone.
 *
 * A grid track of `1fr` is never narrower than its widest card's content,
 * and a programme's label -- "BA Computer Science (Informatics) at Eastwell
 * Polytechnic University" -- does not wrap, so once the Programmes group
 * appeared the one column grew past the screen and the page scrolled
 * sideways at 390px. `minmax(0, 1fr)` lets the column be the screen's width
 * and the label end in an ellipsis, as the wider grids already do.
 *
 * This is a CSS rule, not component state, so it is asserted against the
 * stylesheet.
 */
const css = readFileSync(join(process.cwd(), 'src/app/(sa)/study-abroad.css'), 'utf8');

/** The declarations of the first rule for one selector outside a media query. */
function block(selector: string): string {
  const at = css.indexOf(`\n${selector}{`);
  expect(at, `expected a rule for \`${selector}\``).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('the site search results grid', () => {
  it('lets its one column on a phone shrink to the screen', () => {
    expect(block('.sa .srch__grid')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });
});

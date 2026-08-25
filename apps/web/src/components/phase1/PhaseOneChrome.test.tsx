import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Crumbs } from './PhaseOneChrome';

/**
 * The shared trail shipped a literal "/" text node and no current-page marker,
 * and its only styling lived inside `@scope (.visual-courses-page)` in
 * visual-reference.css. Every page outside that scope — Phase 1 detail pages,
 * compare, success stories, editorial — rendered a default <ol>: one "/Label"
 * per line, stacked vertically. The separator is now drawn by CSS, so the
 * markup carries no slash of its own.
 */
describe('shared public breadcrumb', () => {
  const html = renderToStaticMarkup(
    <Crumbs items={[['Home', '/'], ['Scholarships', '/scholarships'], ['International Excellence Scholarship']]} />,
  );

  it('links every ancestor and marks only the current page', () => {
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/scholarships"');
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    // the current page is the last crumb, and is not a link
    expect(html).toMatch(/aria-current="page"[^>]*>International Excellence Scholarship</);
  });

  it('ships no literal separator for CSS to duplicate', () => {
    expect(html).not.toContain('class="sep"');
    expect(html).not.toContain('>/<');
  });

  it('stays a labelled ordered list', () => {
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('<ol>');
    expect((html.match(/<li>/g) ?? []).length).toBe(3);
  });
});

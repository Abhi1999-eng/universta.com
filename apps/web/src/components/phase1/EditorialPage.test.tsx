import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/* The chrome reaches for the app router; the page body is what is tested. */
vi.mock('./PhaseOneChrome', () => ({
  PhaseOneHeader: () => null,
  PhaseOneFooter: () => null,
  Crumbs: () => null,
}));

import { EditorialPage } from './EditorialPage';

/**
 * A page with no published sections -- the live FAQ, for one -- showed the
 * build's own notes to students: "Local Phase 1 ... managed through the local
 * editorial catalogue". It now tells them where to get an answer instead.
 */
describe('an editorial page nobody has written yet', () => {
  const html = renderToStaticMarkup(
    <EditorialPage page={null} fallbackTitle="FAQ" fallbackDescription="Answers about Universta." />,
  );

  it('does not describe the CMS to the reader', () => {
    expect(html).not.toMatch(/Local Phase 1|editorial catalogue/i);
  });

  it('points the reader to counselling', () => {
    expect(html).toContain('Nothing published here yet');
    expect(html).toContain('href="/counselling"');
  });
});

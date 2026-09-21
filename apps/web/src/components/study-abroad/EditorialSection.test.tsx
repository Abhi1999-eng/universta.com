import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Section } from '@/lib/countries';
import { EditorialSection } from './EditorialSection';

const prose = (paragraphs: string[]): Section =>
  ({
    id: 's1',
    sectionKey: 'why-study',
    sectionType: 'RICH_TEXT',
    eyebrow: 'The case for Germany',
    heading: 'Why students choose Germany',
    subheading: null,
    bodyJson: { paragraphs },
  }) as unknown as Section;

describe('editorial prose', () => {
  it('prints a short section once, in full', () => {
    const html = renderToStaticMarkup(
      <EditorialSection section={prose(['<p>One.</p>', '<p>Two.</p>'])} n="13" alt={false} />,
    );
    expect(html.match(/One\./g) ?? []).toHaveLength(1);
    expect(html.match(/Two\./g) ?? []).toHaveLength(1);
    expect(html).not.toContain('longform');
  });

  /* A long essay keeps its opening on the page and the rest behind the
     toggle, rather than pushing the guide several screens down. */
  it('keeps the opening of a long section and folds the rest', () => {
    const html = renderToStaticMarkup(
      <EditorialSection
        section={prose(['<p>One.</p>', '<p>Two.</p>', '<p>Three.</p>', '<p>Four.</p>'])}
        n="13"
        alt={false}
      />,
    );
    const [head, fold] = html.split('class="longform"');
    expect(head).toContain('Two.');
    expect(head).not.toContain('Three.');
    expect(fold).toContain('Three.');
    expect(fold).toContain('Four.');
    expect(html.match(/One\./g) ?? []).toHaveLength(1);
  });

  it('numbers its eyebrow with its place in the guide', () => {
    const html = renderToStaticMarkup(
      <EditorialSection section={prose(['<p>One.</p>'])} n="13" alt={false} />,
    );
    expect(html).toContain('<span class="eyebrow__n">13</span> The case for Germany');
  });
});

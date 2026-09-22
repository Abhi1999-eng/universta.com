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

describe('editorial subheading', () => {
  const withSubheading = (subheading: string) =>
    ({ ...prose(['<p>One.</p>']), subheading }) as unknown as Section;

  /* Written in the admin's rich text editor, so it is HTML, not text. */
  it('renders the subheading as the rich text it was written in', () => {
    const html = renderToStaticMarkup(
      <EditorialSection section={withSubheading('<p>A lead worth reading.</p>')} n="13" alt={false} />,
    );
    expect(html).toContain('<div class="sec-lead"><div class="rich-text"><p>A lead worth reading.</p>');
    expect(html).not.toContain('&lt;p&gt;');
  });

  /* An emptied editor saves "<p><br></p>", which printed as text on the page. */
  it('treats an emptied editor as no subheading', () => {
    const html = renderToStaticMarkup(
      <EditorialSection section={withSubheading('<p><br></p>')} n="13" alt={false} />,
    );
    expect(html).not.toContain('sec-lead');
  });
});

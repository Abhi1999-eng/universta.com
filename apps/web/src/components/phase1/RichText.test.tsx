// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RichText, richTextToPlainText, safeRichText } from './RichText';

/** What the browser builds from the markup: each element, and every
 *  attribute on it that would run script -- a handler, or a script address. */
function parsed(html: string) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const elements = [...body.querySelectorAll('*')];
  return {
    tags: elements.map((element) => element.tagName.toLowerCase()),
    live: elements.flatMap((element) =>
      [...element.attributes]
        .filter((attribute) => /^on/i.test(attribute.name) || /^\s*javascript:/i.test(attribute.value))
        .map((attribute) => `${element.tagName.toLowerCase()} ${attribute.name}`),
    ),
    text: body.textContent,
  };
}

describe('RichText', () => {
  it('renders allowlisted formatted content and Media Library images', () => {
    const html = renderToStaticMarkup(<RichText value={'<h2>Heading</h2><p><strong>Copy</strong></p><img src="/api/v1/media/demo.webp" alt="Demo">'} />);
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('/api/v1/media/demo.webp');
  });

  it('removes executable tags, handlers, unsafe links, and base64 images', () => {
    const safe = safeRichText('<script>alert(1)</script><p onclick="bad()">Safe</p><a href="javascript:bad()">No</a><img src="data:image/png;base64,x">');
    expect(safe).toContain('<p>Safe</p>');
    expect(safe).not.toContain('alert(1)');
    expect(safe).not.toContain('onclick');
    expect(safe).not.toContain('javascript:');
    expect(safe).not.toContain('<img');
  });

  it('preserves only safe alignment emitted by the shared Admin editor', () => {
    expect(
      safeRichText('<p style="text-align: center; color: red">Aligned</p>'),
    ).toBe('<p style="text-align: center">Aligned</p>');
    expect(safeRichText('<p style="text-align: justify">Nope</p>')).toBe('<p>Nope</p>');
  });
});

/**
 * The Admin rich-text editor's `%` autocomplete inserts an entity as an
 * internal link. That link is only worth inserting if it survives every
 * sanitiser between the editor and the page, so the public end of that contract
 * is pinned here as well as in the Admin.
 */
describe('internal entity links from the editor autocomplete', () => {
  it('keeps a root-relative entity link and hardens it', () => {
    const inserted =
      '<p>Partnered with <a href="/universities/indian-institute-of-science" rel="noopener noreferrer">Indian Institute of Science</a>.</p>';

    const rendered = safeRichText(inserted);

    expect(rendered).toContain('href="/universities/indian-institute-of-science"');
    expect(rendered).toContain('rel="noopener noreferrer"');
    expect(rendered).toContain('Indian Institute of Science');
  });

  it('strips an href that only looks root-relative', () => {
    /* `//evil.example` is protocol-relative, not internal. The editor refuses
     * to build one, and the renderer refuses to trust one. */
    expect(safeRichText('<a href="//evil.example">x</a>')).toBe('<a>x</a>');
    expect(safeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });
});

/**
 * A tag cut off at the end of a value has no `>` for the tag pass to find.
 * It used to reach the page as written, and the browser built it into a
 * live element: an intro, a note or an FAQ answer ending in
 * `<img src=x onerror=...` ran its script on every visit.
 */
describe('a tag cut off at the end of a value', () => {
  const cutOff = [
    '<p>Intro</p><img src=x onerror="alert(document.domain)"',
    '<p>Intro</p><img src=x onerror=alert(1)',
    "<p>Intro</p><img src='x' onerror='alert(1)'",
    '<p>Intro</p><svg onload=alert(1)',
    '<p>Intro</p><svg><img src=x onerror=alert(1)',
  ];

  it.each(cutOff)('renders %s as text, building no element from it', (value) => {
    const page = parsed(renderToStaticMarkup(<RichText value={value} />));
    expect(page.live).toEqual([]);
    expect(page.tags).toEqual(['div', 'p']);
    expect(page.text).toContain('Intro');
  });

  it('escapes the stray "<" and nothing else', () => {
    expect(safeRichText('<p>Intro</p><img src=x onerror="alert(1)"')).toBe(
      '<p>Intro</p>&lt;img src=x onerror="alert(1)"',
    );
  });

  it('runs no handler a kept tag was written with, nor a script address', () => {
    const page = parsed(
      safeRichText(
        '<p style="text-align: center" onmouseover="alert(1)">A</p>' +
          '<a href="/x" onclick="alert(1)">B</a>' +
          '<a href=" javascript:alert(1)">C</a>' +
          '<a href="JaVaScRiPt:alert(1)">D</a>' +
          '<img src="https://cdn.example/a.png" onerror="alert(1)" alt="E">' +
          '<img src="javascript:alert(1)" alt="F">' +
          '<img src="https://cdn.example/b.png" alt="G" onerror="a>b">',
      ),
    );
    expect(page.live).toEqual([]);
    expect(page.tags).toEqual(['p', 'a', 'a', 'a', 'img', 'img']);
  });

  it('leaves the editor’s ordinary rich text exactly as it was', () => {
    const authored =
      '<h2>Heading</h2><p style="text-align: center">Centred <strong>bold</strong> &amp; <em>italic</em>, 3 &lt; 5</p>' +
      '<ul><li>One</li><li><u>Two</u></li></ul><blockquote>Quoted</blockquote><hr>' +
      '<p><a href="/universities/x" rel="noopener noreferrer">X</a><br><img src="/api/v1/media/a.webp" alt="A"></p>';
    expect(safeRichText(authored)).toBe(authored);
  });

  it('reads a lone "<" in the text as it always did', () => {
    const value = '<p>Scores</p>must be < 6';
    expect(parsed(renderToStaticMarkup(<RichText value={value} />)).text).toBe('Scoresmust be < 6');
    expect(richTextToPlainText(value)).toBe('Scores must be < 6');
  });
});

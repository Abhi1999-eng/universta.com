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

/**
 * Rich text usually reaches the page already sanitised by the API, its
 * attribute values escaped. Escaping them again turned an image address's
 * `&amp;` into `&amp;amp;`, which the browser reads as a different address.
 * A value is now read as the browser reads it, checked as that, and written
 * back once -- so sanitising twice is sanitising once.
 */
describe('sanitising what is already sanitised', () => {
  const served = [
    '<p><img src="https://cdn.example/a.jpg?w=640&amp;h=480" alt="Tom &amp; Jerry &quot;live&quot;"></p>',
    '<p><a href="/courses?subject=law&amp;country=japan" rel="noopener noreferrer">Law in Japan</a></p>',
    '<p>Fees &amp; funding, 3 &lt; 5</p>',
    '<p><img src="/api/v1/media/a.webp" alt="caf&eacute;"></p>',
    '<p><a href="https://example.com/?q=&amp;lt;b&amp;gt;">Q</a></p>',
  ];

  it.each(served)('changes nothing on a second pass over %s', (value) => {
    const once = safeRichText(value);
    expect(safeRichText(once)).toBe(once);
  });

  it('keeps an image address the API already escaped as it was', () => {
    const once = safeRichText(served[0]);
    expect(once).toContain('src="https://cdn.example/a.jpg?w=640&amp;h=480"');
    expect(once).not.toContain('&amp;amp;');
    const image = new DOMParser().parseFromString(once, 'text/html').querySelector('img');
    expect(image?.getAttribute('src')).toBe('https://cdn.example/a.jpg?w=640&h=480');
    expect(image?.getAttribute('alt')).toBe('Tom & Jerry "live"');
  });

  it('still escapes a raw "&" once, as before', () => {
    expect(safeRichText('<img src="https://cdn.example/a.jpg?w=1&h=2" alt="A & B">')).toBe(
      '<img src="https://cdn.example/a.jpg?w=1&amp;h=2" alt="A &amp; B">',
    );
  });

  it('leaves an entity it does not know as the text it is', () => {
    const image = new DOMParser()
      .parseFromString(safeRichText(served[3]), 'text/html')
      .querySelector('img');
    expect(image?.getAttribute('alt')).toBe('caf&eacute;');
  });
});

/**
 * Reading entities in attribute values must not let an address past the
 * check that the browser would then read as another: an encoded colon, an
 * encoded second slash, or a tab or backslash the address parser drops or
 * turns into a slash.
 */
describe('addresses that only look safe', () => {
  const href = (value: string) =>
    new DOMParser()
      .parseFromString(safeRichText(value), 'text/html')
      .querySelector('a')
      ?.getAttribute('href') ?? null;

  it.each([
    '<a href="javascript&colon;alert(1)">x</a>',
    '<a href="javascript&#58;alert(1)">x</a>',
    '<a href="javascript&#x3A;alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
  ])('keeps no script address from %s', (value) => {
    expect(href(value)).toBeNull();
    expect(parsed(safeRichText(value)).live).toEqual([]);
  });

  it.each([
    '<a href="/&#47;evil.example">x</a>',
    '<a href="/&#x2F;evil.example">x</a>',
    '<a href="/\\evil.example">x</a>',
    '<a href="/&#92;evil.example">x</a>',
    '<a href="/\t/evil.example">x</a>',
    '<a href="/&#9;/evil.example">x</a>',
    '<a href="/&#10;/evil.example">x</a>',
  ])('links nowhere from %s, which a browser reads as another host', (value) => {
    expect(href(value)).toBeNull();
  });

  it('keeps an internal link whose query the API escaped', () => {
    expect(href('<a href="/courses?subject=law&amp;level=pg">x</a>')).toBe('/courses?subject=law&level=pg');
  });

  it('reads an encoded https address as the address it is', () => {
    expect(href('<a href="https&#58;//example.com/a">x</a>')).toBe('https://example.com/a');
  });

  it('adds no image from an encoded script address', () => {
    expect(safeRichText('<img src="javascript&#58;alert(1)" alt="x">')).toBe('');
  });
});

/**
 * What is already stored. The admin's and the API's sanitisers each escaped
 * an attribute the editor had escaped already, so a stored link carries
 * `&amp;` and some carry `&amp;amp;`. The page reads one layer, as the
 * browser would, and checks the address it is left with. It never reads a
 * second: a value decoded until nothing changed could be checked as one
 * address and reach the browser as another, and `&amp;lt;` written as
 * text would become a tag.
 */
describe('attribute values as they are stored', () => {
  const element = (html: string, selector: string) =>
    new DOMParser().parseFromString(html, 'text/html').querySelector(selector);

  it('gives a stored link with "&amp;" a plain "&" in its address', () => {
    const stored = '<p><a href="https://x.y/?a=1&amp;b=2">Both</a></p>';
    const html = renderToStaticMarkup(<RichText value={stored} />);
    expect(html).toContain('href="https://x.y/?a=1&amp;b=2"');
    expect(html).not.toContain('&amp;amp;');
    expect(element(html, 'a')?.getAttribute('href')).toBe('https://x.y/?a=1&b=2');
    expect(safeRichText(safeRichText(stored))).toBe(safeRichText(stored));
  });

  /* `/m.png` is not a Media Library address, so the image is dropped
     whatever its query says: only https and /media/ or /api/v1/media/
     images are kept. */
  it('drops a stored image outside the Media Library, "&amp;amp;" or not', () => {
    expect(safeRichText('<img src="/m.png?x=1&amp;amp;y=2">')).toBe('');
    expect(renderToStaticMarkup(<RichText value={'<p>A</p><img src="/m.png?x=1&amp;amp;y=2">'} />)).toBe(
      '<div class="rich-text"><p>A</p></div>',
    );
  });

  /* Two layers stored, one read: the address keeps the one layer the
     stored text still has, literally, and a second pass over the page's
     markup leaves it there. Mending it is the stored row's repair, not a
     second decode here. */
  it('reads one layer of a stored "&amp;amp;", and only one', () => {
    const stored = '<img src="/media/m.png?x=1&amp;amp;y=2" alt="Tom &amp;amp; Jerry">';
    const once = safeRichText(stored);
    expect(once).toBe('<img src="/media/m.png?x=1&amp;amp;y=2" alt="Tom &amp;amp; Jerry">');
    expect(element(once, 'img')?.getAttribute('src')).toBe('/media/m.png?x=1&amp;y=2');
    expect(element(once, 'img')?.getAttribute('alt')).toBe('Tom &amp; Jerry');
    expect(safeRichText(once)).toBe(once);

    const link = safeRichText('<a href="https://x.y/?a=1&amp;amp;b=2">x</a>');
    expect(element(link, 'a')?.getAttribute('href')).toBe('https://x.y/?a=1&amp;b=2');
    expect(safeRichText(link)).toBe(link);
  });

  /* The check is made on the value after its one decode, and that value
     is what the browser is given: a script address or another host
     escaped twice is still text after one read, and never becomes the
     address the browser follows. */
  it.each([
    '<a href="javascript&amp;#58;alert(1)">x</a>',
    '<a href="javascript&amp;colon;alert(1)">x</a>',
    '<a href="&amp;#106;avascript:alert(1)">x</a>',
    '<a href="https&amp;#58;//evil.example">x</a>',
  ])('links nowhere from the twice-escaped %s', (value) => {
    const html = safeRichText(value);
    expect(element(html, 'a')?.getAttribute('href') ?? null).toBeNull();
    expect(parsed(html).live).toEqual([]);
  });

  it('keeps a twice-escaped slash on this site', () => {
    const html = safeRichText('<a href="/&amp;#47;evil.example">x</a>');
    const href = element(html, 'a')?.getAttribute('href') ?? '';
    expect(href).toBe('/&#47;evil.example');
    expect(new URL(href, 'https://universta.com').host).toBe('universta.com');
    expect(safeRichText(html)).toBe(html);
  });

  it('adds no image from a twice-escaped script address', () => {
    expect(safeRichText('<img src="javascript&amp;#58;alert(1)" alt="x">')).toBe('');
  });
});

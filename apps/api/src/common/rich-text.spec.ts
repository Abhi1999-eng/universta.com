import { sanitizeRichText } from './rich-text';

describe('sanitizeRichText', () => {
  it('keeps the supported editor subset', () => {
    expect(
      sanitizeRichText(
        '<h2>Heading</h2><p><strong>Text</strong></p><ul><li>One</li></ul>',
      ),
    ).toContain('<h2>Heading</h2>');
  });

  it('removes scripts, event attributes and unsafe links', () => {
    const result = sanitizeRichText(
      '<script>alert(1)</script><p onclick="alert(1)">Safe</p><a href="javascript:alert(1)">Bad</a>',
    );
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert(1)');
  });

  it('preserves only safe editor alignment on supported block elements', () => {
    expect(
      sanitizeRichText('<p style="text-align: center; color: red">Aligned</p>'),
    ).toBe('<p style="text-align: center">Aligned</p>');
    expect(sanitizeRichText('<p style="text-align: justify">Nope</p>')).toBe(
      '<p>Nope</p>',
    );
  });

  /* A tag left open at the end has no ">" for the tag pass to find. It used
     to come through as written, and a browser reads it as a live element. */
  it.each([
    ['an image', '<p>Intro</p><img src=x onerror=alert(1)'],
    ['an svg', '<p>Intro</p><svg onload=alert(1)'],
    ['a quoted handler', '<p>Intro</p><img src=x onerror="alert(1)"'],
    ['a kept tag name', '<p>Intro</p><p onclick="alert(1)"'],
    ['a bare tag', 'Intro<img'],
  ])('escapes %s left open at the end as text', (_, input) => {
    const result = String(sanitizeRichText(input));
    expect(
      result.startsWith(input.startsWith('<p>') ? '<p>Intro</p>' : 'Intro'),
    ).toBe(true);
    expect(result).not.toMatch(/<(img|svg)/i);
    expect(result).not.toMatch(/<p\s/i);
    expect(result).toContain('&lt;');
    /* Every "<" left starts a whole tag. */
    expect(result).not.toMatch(/<(?![a-z/][^<>]*>)/i);
  });

  it('keeps no event handler on a tag it keeps', () => {
    const result = String(
      sanitizeRichText(
        '<p onclick="alert(1)" style="text-align: left">A</p><a href="https://example.com" onmouseover="alert(1)">B</a><img src="/api/v1/media/a.webp" alt="A" onerror="alert(1)">',
      ),
    );
    expect(result).toBe(
      '<p style="text-align: left">A</p><a href="https://example.com" rel="noopener noreferrer">B</a><img src="/api/v1/media/a.webp" alt="A">',
    );
  });

  it('leaves what the editor writes unchanged', () => {
    const html = [
      '<h2>Why study here</h2>',
      '<p style="text-align: center">Fees &lt; 10,000 &amp; <strong>low</strong>, <em>really</em>.</p>',
      '<ul><li>One</li><li><a href="https://example.com/x" rel="noopener noreferrer">Two</a></li></ul>',
      '<ol><li><a href="/subjects/computing" rel="noopener noreferrer">Three</a></li></ol>',
      '<blockquote>Quote</blockquote><hr><p>Line<br>break</p>',
      '<img src="/api/v1/media/banner.webp" alt="Banner">',
      '<img src="https://cdn.example.com/a.png" alt="">',
    ].join('');
    expect(sanitizeRichText(html)).toBe(html);
    /* Run twice, it changes nothing more. */
    expect(sanitizeRichText(sanitizeRichText(html))).toBe(html);
  });

  it('keeps approved Media Library image URLs and drops base64 image payloads', () => {
    expect(
      sanitizeRichText('<img src="/api/v1/media/banner.webp" alt="Banner">'),
    ).toContain('banner.webp');
    expect(
      sanitizeRichText('<img src="data:image/png;base64,unsafe" alt="No">'),
    ).not.toContain('<img');
  });
  /* The editor hands its HTML over with attribute values already escaped.
     Escaping them again stored `&amp;amp;`, one more layer on every save,
     and sent an image to `?w=1&amp;h=2`. Each value is decoded once, checked
     as the browser reads it, and escaped once. */
  describe('attribute values', () => {
    it('keeps an escaped ampersand escaped once', () => {
      const html =
        '<p><a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer">Link</a></p>' +
        '<img src="https://cdn.example.com/a.jpg?w=1&amp;h=2" alt="Tom &amp; Jerry">';
      expect(sanitizeRichText(html)).toBe(html);
    });

    it('escapes a bare ampersand once', () => {
      expect(
        sanitizeRichText(
          '<a href="https://example.com/?a=1&b=2">x</a><img src="/api/v1/media/a.webp?w=1&h=2" alt="R&D">',
        ),
      ).toBe(
        '<a href="https://example.com/?a=1&amp;b=2" rel="noopener noreferrer">x</a><img src="/api/v1/media/a.webp?w=1&amp;h=2" alt="R&amp;D">',
      );
    });

    it('adds no layer to a value saved before the fix', () => {
      /* Already stored with an extra layer: decoded once it is the text
         `&amp;`, and written back the same, not a third layer. */
      const html =
        '<a href="https://example.com/?a=1&amp;amp;b=2" rel="noopener noreferrer">x</a>';
      expect(sanitizeRichText(html)).toBe(html);
    });

    it('decodes one layer only', () => {
      expect(
        sanitizeRichText('<img src="/media/a.webp" alt="&amp;lt;b&amp;gt;">'),
      ).toBe('<img src="/media/a.webp" alt="&amp;lt;b&amp;gt;">');
      expect(
        sanitizeRichText('<img src="/media/a.webp" alt="&lt;b&gt; &#65;">'),
      ).toBe('<img src="/media/a.webp" alt="&lt;b&gt; A">');
    });

    it('reads a value to the quote that opened it', () => {
      expect(
        sanitizeRichText(
          '<img src="/media/a.webp" alt="Tom\'s"><img src=\'/media/b.webp\' alt=\'Say "hi"\'>',
        ),
      ).toBe(
        '<img src="/media/a.webp" alt="Tom&#39;s"><img src="/media/b.webp" alt="Say &quot;hi&quot;">',
      );
    });

    it('keeps no attribute an escaped quote spells out', () => {
      const result = String(
        sanitizeRichText(
          '<img src="/media/a.webp" alt="&quot; onerror=&quot;alert(1)">',
        ),
      );
      /* The handler is text inside the alt, never an attribute. */
      expect(result).toMatch(/^<img src="[^"]*" alt="[^"]*">$/);
      expect(result).toBe(
        '<img src="/media/a.webp" alt="&quot; onerror=&quot;alert(1)">',
      );
    });

    /* Decoding can reveal an address the check refuses; it is checked
       after decoding, as the browser would follow it. */
    it.each([
      ['a decimal entity', '&#106;avascript:alert(1)'],
      ['a hex entity', '&#x6A;avascript:alert(1)'],
      ['a named colon', 'javascript&colon;alert(1)'],
      ['an encoded tab', 'java&#9;script:alert(1)'],
      ['an encoded leading space', '&#32;javascript:alert(1)'],
      [
        'a fully encoded scheme',
        '&#x6a;&#x61;&#x76;&#x61;&#x73;&#x63;&#x72;&#x69;&#x70;&#x74;&#x3a;alert(1)',
      ],
      ['an encoded second slash', '/&#47;evil.example'],
      ['an encoded tab between slashes', '/&#9;/evil.example'],
      ['an encoded backslash', '/&#92;evil.example'],
      ['a backslash', '/\\evil.example'],
    ])('drops a link spelled with %s', (_, href) => {
      const result = String(sanitizeRichText(`<a href="${href}">Bad</a>`));
      expect(result).toBe('<a>Bad</a>');
    });

    it.each([
      ['a script address', '&#106;avascript:alert(1)'],
      ['an inline payload', '&#100;ata:image/png;base64,AAAA'],
      ['a protocol-relative address', '&#47;/evil.example/a.png'],
    ])('drops an image spelled as %s', (_, src) => {
      expect(sanitizeRichText(`<p>A</p><img src="${src}" alt="x">`)).toBe(
        '<p>A</p>',
      );
    });

    it('keeps an address an entity spells safely, escaped once', () => {
      expect(
        sanitizeRichText(
          '<a href="https&#58;//example.com/a?b=1&#38;c=2">x</a>',
        ),
      ).toBe(
        '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">x</a>',
      );
    });

    it('changes nothing more the second time', () => {
      const inputs = [
        '<a href="https://example.com/?a=1&amp;b=2">x</a>',
        '<a href="https://example.com/?a=1&b=2&amp;amp;c=3">x</a>',
        '<img src="https://cdn.example.com/a.jpg?w=1&amp;h=2" alt="Tom &amp; Jerry">',
        '<img src="/media/a.webp" alt="Tom\'s &quot;best&quot; &lt;3 &#x1F600; &unknown; &#0; &#xD800;">',
        '<img src="/media/a.webp" alt=\'He said "no"\'>',
        '<a href=" &#9;https://example.com/a b ">x</a>',
        '<a href="&#106;avascript:alert(1)">x</a><p onclick="alert(1)">y</p>',
        '<p>Intro</p><img src=x onerror="alert(1)"',
      ];
      for (const input of inputs) {
        const once = sanitizeRichText(input);
        expect(sanitizeRichText(once)).toBe(once);
      }
    });
  });
});

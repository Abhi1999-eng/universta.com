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
});

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

  it('keeps approved Media Library image URLs and drops base64 image payloads', () => {
    expect(
      sanitizeRichText('<img src="/api/v1/media/banner.webp" alt="Banner">'),
    ).toContain('banner.webp');
    expect(
      sanitizeRichText('<img src="data:image/png;base64,unsafe" alt="No">'),
    ).not.toContain('<img');
  });
});

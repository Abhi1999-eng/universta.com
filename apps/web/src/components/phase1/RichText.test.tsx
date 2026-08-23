import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RichText, safeRichText } from './RichText';

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
});

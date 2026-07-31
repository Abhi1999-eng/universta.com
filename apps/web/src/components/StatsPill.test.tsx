import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatsPill } from './StatsPill';

describe('StatsPill', () => {
  it('renders manual or resolved values with labels in configured order', () => {
    const html = renderToStaticMarkup(
      <StatsPill
        pill={{
          visible: true,
          variant: 'pill',
          icon: { visible: true, name: 'dot' },
          items: [
            { id: 'destinations', label: 'places', value: 13, displayOrder: 0 },
            { id: 'universities', label: 'universities', value: 942, displayOrder: 1 },
          ],
        }}
      />,
    );
    expect(html).toContain('13');
    expect(html).toContain('places');
    expect(html).toContain('942');
    expect(html.indexOf('places')).toBeLessThan(html.indexOf('universities'));
  });

  it('renders a balanced single-stat variant and no wrapper when absent', () => {
    const html = renderToStaticMarkup(
      <StatsPill
        pill={{
          visible: true,
          variant: 'badge',
          icon: { visible: false, name: 'globe' },
          items: [{ id: 'one', label: 'published university', value: 1, displayOrder: 0 }],
        }}
      />,
    );
    expect(html).toContain('hero-badge');
    expect(html).toContain('data-item-count="1"');
    expect(renderToStaticMarkup(<StatsPill pill={null} />)).toBe('');
  });
});

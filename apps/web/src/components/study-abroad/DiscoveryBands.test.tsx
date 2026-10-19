import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConnectBand } from './DiscoveryBands';

const items = [{ id: 'a', name: 'Ashcroft', href: '/a' }];

describe('the Explore next band\'s related groups', () => {
  it('prints a group\'s note under its list when it has one', () => {
    const html = renderToStaticMarkup(
      <ConnectBand actions={[]} groups={[{ title: 'Others', items, note: 'In alphabetical order.' }]} />,
    );
    expect(html).toContain('</ul><p class="h-relgroup__note">In alphabetical order.</p></div>');
  });

  it('prints nothing more for a group without one', () => {
    const html = renderToStaticMarkup(<ConnectBand actions={[]} groups={[{ title: 'Others', items }]} />);
    expect(html).not.toContain('h-relgroup__note');
  });
});

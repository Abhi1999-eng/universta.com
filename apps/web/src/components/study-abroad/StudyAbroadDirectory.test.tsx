import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => '/study-abroad',
  useSearchParams: () => new URLSearchParams(''),
}));

import { DirectoryView } from './DirectoryView';
import type { DestinationDirectory, Destination } from '@/lib/study-abroad';

/**
 * The directory shows two different kinds of thing and must never confuse them:
 * a destination with a published guide, which navigates, and one without, which
 * does not exist as a page and must not pretend to.
 */
const destination = (over: Partial<Destination> = {}): Destination => ({
  name: 'Germany',
  slug: 'germany',
  iso2Code: 'DE',
  isPopular: true,
  isAvailable: true,
  region: 'Europe',
  summary: null,
  bands: ['#000000', '#DD0000', '#FFCE00'],
  ...over,
});

const directory = (over: Partial<DestinationDirectory> = {}): DestinationDirectory => ({
  available: [destination()],
  comingSoon: [
    destination({
      name: 'Albania',
      slug: null,
      iso2Code: 'AL',
      isPopular: false,
      isAvailable: false,
    }),
  ],
  regions: ['Europe', 'Asia'],
  counts: { available: 1, popular: 1, total: 2 },
  ...over,
});

describe('destination directory', () => {
  it('links a published destination to its guide', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('href="/study-abroad/germany"');
    expect(html).toContain('Guide');
  });

  it('does not link a destination that has no guide', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('dir__card--soon');
    expect(html).toContain('Soon');
    /* The only href on the page belongs to the published one. */
    expect(html.match(/href="\/study-abroad\//g) ?? []).toHaveLength(1);
    expect(html).not.toContain('href="/study-abroad/albania"');
  });

  it('counts what is on screen', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('2 countries');
  });

  it('groups by region, in the order the design lists them', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({ name: 'Singapore', slug: 'singapore', region: 'Asia' }),
            destination(),
          ],
          comingSoon: [],
          counts: { available: 2, popular: 2, total: 2 },
        })}
      />,
    );
    expect(html.indexOf('data-group="Europe"')).toBeLessThan(html.indexOf('data-group="Asia"'));
  });

  it('offers every region the directory knows, plus All', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    for (const region of ['All', 'Europe', 'Asia']) expect(html).toContain(`>${region}<`);
  });

  it('falls back to a neutral mark for a destination outside the reference list', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [destination({ name: 'Testland', slug: 'testland', iso2Code: null, bands: null })],
          comingSoon: [],
          counts: { available: 1, popular: 1, total: 1 },
        })}
      />,
    );
    /* No crash, and the card keeps its shape with a readable stand-in code. */
    expect(html).toContain('cchip__bands');
    expect(html).toContain('>TE<');
  });

  it('says so plainly when a filter matches nothing', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [],
          comingSoon: [],
          counts: { available: 0, popular: 0, total: 0 },
        })}
      />,
    );
    expect(html).toContain('directory-empty');
    expect(html).toContain('0 countries');
  });
});

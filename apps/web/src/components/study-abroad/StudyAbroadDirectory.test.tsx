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
  counts: { universities: 4, courses: 10, scholarships: 5, consultants: 3 },
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
    /* Every guide link on the page is the published one's -- it may appear
       twice, in the popular row and under its region. */
    const hrefs = html.match(/href="\/study-abroad\/[^"]*"/g) ?? [];
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs)).toEqual(new Set(['href="/study-abroad/germany"']));
    expect(html).not.toContain('href="/study-abroad/albania"');
  });

  it('counts what is on screen', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('2 countries');
  });

  /* The merged listing carries what the approved countries page showed under a
     name, cut to what a 276px chip can hold on one line. A card states only
     what the destination actually has: a zero is an absence the student cannot
     act on, so it is left out rather than printed. */
  it('reports what a destination has linked to it', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('4 universities · 10 courses');
  });

  it('stops at two facts, so the line never wraps the card taller', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).not.toContain('5 scholarships');
    expect(html).not.toContain('3 consultants');
  });

  /* A destination with no universities or courses still says what it does
     have, rather than saying nothing at all. */
  it('falls back to whatever the destination does have', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({
              counts: { universities: 0, courses: 0, scholarships: 3, consultants: 2 },
            }),
          ],
        })}
      />,
    );
    expect(html).toContain('3 scholarships · 2 consultants');
  });

  it('leaves a count out of the line when there is nothing to report', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({
              counts: { universities: 1, courses: 0, scholarships: 0, consultants: 2 },
            }),
          ],
        })}
      />,
    );
    expect(html).toContain('1 university · 2 consultants');
    expect(html).not.toContain('0 courses');
    expect(html).not.toContain('0 scholarships');
    expect(html).not.toContain('· 0 ');
  });

  it('says nothing at all when a destination has nothing linked to it', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({
              counts: { universities: 0, courses: 0, scholarships: 0, consultants: 0 },
            }),
          ],
        })}
      />,
    );
    expect(html).not.toContain('h-card__m');
  });

  it('offers the "has" filters the merged listing needs', () => {
    const html = renderToStaticMarkup(<DirectoryView directory={directory()} />);
    expect(html).toContain('data-filter-group="has"');
    for (const label of [
      'Anything',
      'Country guide',
      'Universities',
      'Scholarships',
      'Consultants',
    ])
      expect(html).toContain(label);
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
    /* No crash, and the card keeps its shape: the neutral navy bands fill the
       mark rather than leaving an empty box beside the name. */
    expect(html).toContain('cchip__bands');
    expect(html).toContain('background:#0C2038');
  });

  /* Bands can say what a flag is made of and not what it looks like: India's
     stripes run across and were drawn down the chip, and Japan's disc is not
     a stripe at all. The mark draws the flag itself now. */
  it('draws the country\'s own flag', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({ name: 'India', slug: 'india', iso2Code: 'IN', bands: ['#ff9933', '#ffffff', '#128807'] }),
          ],
          comingSoon: [],
          counts: { available: 1, popular: 1, total: 1 },
        })}
      />,
    );
    expect(html).toContain('src="/flags/in.svg"');
    /* Decorative: the name is beside it as real text. */
    expect(html).toContain('alt=""');
  });

  /* A destination outside the reference list has nothing to ask for, so the
     card keeps the bands rather than requesting a flag that is not there and
     drawing the browser's broken-image mark over them. A made-up code is the
     same case: the artwork ships with the site, so what it covers is known
     before the request rather than after it fails. */
  it.each([
    ['no ISO code', null],
    ['a code the artwork does not cover', 'QX'],
  ])('asks for no artwork with %s', (_case, iso2Code) => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [destination({ name: 'Testland', slug: 'testland', iso2Code, bands: null })],
          comingSoon: [],
          counts: { available: 1, popular: 1, total: 1 },
        })}
      />,
    );
    expect(html).not.toContain('/flags/');
    expect(html).toContain('background:#0C2038');
  });

  it('writes nothing across the mark', () => {
    const html = renderToStaticMarkup(
      <DirectoryView
        directory={directory({
          available: [
            destination({ name: 'Denmark', slug: 'denmark', iso2Code: 'DK', bands: ['#c8102e', '#ffffff', '#c8102e'] }),
          ],
          comingSoon: [],
          counts: { available: 1, popular: 1, total: 1 },
        })}
      />,
    );
    expect(html).toContain('background:#c8102e');
    expect(html).not.toContain('cchip__code');
    expect(html).not.toContain('>DK<');
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

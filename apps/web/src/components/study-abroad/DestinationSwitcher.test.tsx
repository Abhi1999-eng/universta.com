import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DESTINATIONS_SHOWN,
  DestinationSwitcher,
} from './DestinationSwitcher';

/**
 * Every country that lists a specialization belongs in its destinations
 * band, and on this catalogue that is two hundred of them -- a wall of
 * chips 5,233px tall that buries everything after it. The band opens on six.
 */

const countries = (howMany: number) =>
  Array.from({ length: howMany }, (_, index) => ({
    id: `c${index}`,
    name: `Country ${index}`,
    slug: `country-${index}`,
    iso2Code: 'IN',
  }));

const render = (howMany: number) =>
  renderToStaticMarkup(
    <DestinationSwitcher
      countries={countries(howMany)}
      label="Artificial Intelligence"
    />,
  );

const chipCount = (html: string) =>
  (html.match(/class="switcher__item"/g) ?? []).length;

describe('the destinations a specialization is taught in', () => {
  it('opens on six of them, however many there are', () => {
    expect(chipCount(render(205))).toBe(DESTINATIONS_SHOWN);
  });

  it('says how many there are in total, by name', () => {
    const html = render(205);
    expect(html).toContain('Show all 205 destinations for Artificial Intelligence');
  });

  it('offers nothing to open when six is all of them', () => {
    const html = render(DESTINATIONS_SHOWN);
    expect(chipCount(html)).toBe(DESTINATIONS_SHOWN);
    expect(html).not.toContain('Show all');
  });

  it('shows the few there are, with no button', () => {
    const html = render(2);
    expect(chipCount(html)).toBe(2);
    expect(html).not.toContain('Show all');
  });

  it('packs a short list to the start rather than stretching it', () => {
    expect(render(2)).toContain('switcher switcher--few');
    expect(render(205)).toContain('class="switcher"');
  });

  it('draws each country’s own flag', () => {
    const html = render(205);
    expect((html.match(/\/flags\/in\.svg/g) ?? []).length).toBe(
      DESTINATIONS_SHOWN,
    );
  });

  it('starts closed, which is what a reader without JavaScript is served', () => {
    expect(render(205)).toContain('aria-expanded="false"');
  });
});

describe('a destination chip’s programme count', () => {
  const chips = (courseCount: number | null) =>
    renderToStaticMarkup(
      <DestinationSwitcher
        countries={[
          { id: 'gb', name: 'United Kingdom', slug: 'united-kingdom', iso2Code: 'GB', courseCount },
        ]}
        label="Software Engineering"
        within="computer-science/software-engineering"
      />,
    );

  it('shows how many programmes it teaches there, as the design’s chips do', () => {
    expect(chips(6)).toContain('<span class="dir__meta" aria-hidden="true">6</span>');
  });

  it('says what the figure counts to a screen reader', () => {
    expect(chips(6)).toContain(
      'aria-label="Software Engineering in United Kingdom, 6 programmes"',
    );
    expect(chips(1)).toContain('1 programme"');
  });

  it('shows no figure, rather than a zero, where nothing is taught yet', () => {
    expect(chips(0)).not.toContain('dir__meta');
    expect(chips(null)).not.toContain('dir__meta');
    expect(chips(0)).toContain('aria-label="Software Engineering in United Kingdom"');
  });
});

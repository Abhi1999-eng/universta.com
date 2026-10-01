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

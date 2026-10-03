import { comingSoonDestinations } from './directory-world';

/**
 * The destinations directory lists what is published, then what is coming.
 *
 * "Coming" was worked out by name, and this table does not spell every country
 * the way the catalogue does: `UK` here is `United Kingdom` there, and `USA` is
 * `United States`. Both therefore appeared twice on /study-abroad -- once as a
 * published guide with its university count, and again a few cards later as a
 * destination coming soon, same flag, no link.
 */

const name = (rows: Array<{ name: string }>) => rows.map((row) => row.name);

describe('the destinations still to come', () => {
  it('drops one the catalogue publishes under a different name', () => {
    const soon = name(
      comingSoonDestinations([
        { name: 'United Kingdom', iso2Code: 'GB' },
        { name: 'United States', iso2Code: 'US' },
      ]),
    );
    expect(soon).not.toContain('UK');
    expect(soon).not.toContain('USA');
  });

  it('still drops one published under this table’s own name', () => {
    expect(
      name(comingSoonDestinations([{ name: 'Japan', iso2Code: 'JP' }])),
    ).not.toContain('Japan');
  });

  it('keeps one the catalogue does not publish at all', () => {
    expect(
      name(comingSoonDestinations([{ name: 'Japan', iso2Code: 'JP' }])),
    ).toContain('India');
  });

  it('matches the code whatever case it arrives in', () => {
    expect(
      name(comingSoonDestinations([{ name: 'Britain', iso2Code: 'gb' }])),
    ).not.toContain('UK');
  });

  it('falls back to the name when a record has no code', () => {
    const soon = name(
      comingSoonDestinations([{ name: 'India', iso2Code: null }]),
    );
    expect(soon).not.toContain('India');
  });
});

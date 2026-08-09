import { describe, expect, it } from 'vitest';
import { applyPicks, directoryQuery } from './page-section-data';

/** The builder's Content source controls only mean something if the public
 * page honours them. These pin the translation from what the admin chose to
 * what the catalogue is actually asked for. */
describe('directory section data settings', () => {
  it('asks for only the limit when nothing else is configured', () => {
    expect(directoryQuery({}, '6')).toEqual({ limit: '6' });
  });

  it('passes through the filters the catalogue API supports', () => {
    expect(
      directoryQuery(
        { filters: { q: 'engineering', country: 'canada' }, sort: 'name' },
        '4',
      ),
    ).toEqual({ limit: '4', q: 'engineering', country: 'canada', sort: 'name' });
  });

  it('drops empty filters rather than sending blank query values', () => {
    expect(directoryQuery({ filters: { q: '', country: '' } }, '6')).toEqual({
      limit: '6',
    });
  });

  /** Manual mode filters client-side, so sending the automatic filters too
   * would narrow the pool the picks are matched against. */
  it('ignores automatic filters and widens the pool in manual mode', () => {
    expect(
      directoryQuery(
        { dataMode: 'manual', filters: { q: 'ignored' }, sort: 'name' },
        '3',
      ),
    ).toEqual({ limit: '50' });
  });

  const items = [
    { slug: 'a', title: 'A', description: '', href: '/a' },
    { slug: 'b', title: 'B', description: '', href: '/b' },
    { slug: 'c', title: 'C', description: '', href: '/c' },
  ];

  it('leaves automatic results untouched', () => {
    expect(applyPicks(items, { dataMode: 'automatic' })).toEqual(items);
  });

  it('keeps hand-picked records in the order the admin chose', () => {
    expect(
      applyPicks(items, { dataMode: 'manual', picks: ['c', 'a'] }).map((i) => i.slug),
    ).toEqual(['c', 'a']);
  });

  /** A picked record that has since been unpublished must not leave a gap or
   * a link to a page that no longer resolves. */
  it('silently drops picks whose record is no longer published', () => {
    expect(
      applyPicks(items, { dataMode: 'manual', picks: ['a', 'gone', 'b'] }).map(
        (i) => i.slug,
      ),
    ).toEqual(['a', 'b']);
  });

  it('shows nothing when manual mode has no picks yet', () => {
    expect(applyPicks(items, { dataMode: 'manual', picks: [] })).toEqual([]);
  });
});

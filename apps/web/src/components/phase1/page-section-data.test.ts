import { describe, expect, it } from 'vitest';
import { applyPicks, directoryItem, directoryQuery } from './page-section-data';

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

  /* T-M2-web. Testimonials have no slug, so the admin saves their ids. */
  it('matches a pick on the record id when the record has no slug', () => {
    const quotes = [
      { slug: '', id: 'q-1', title: 'A', description: '', href: null },
      { slug: '', id: 'q-2', title: 'B', description: '', href: null },
    ];
    expect(
      applyPicks(quotes, { dataMode: 'manual', picks: ['q-2', 'q-1'] }).map((i) => i.id),
    ).toEqual(['q-2', 'q-1']);
  });

  it('still matches a slug first where the record has one', () => {
    const rows = [{ slug: 'b', id: 'id-b', title: 'B', description: '', href: '/b' }];
    expect(applyPicks(rows, { dataMode: 'manual', picks: ['b'] })).toEqual(rows);
    expect(applyPicks(rows, { dataMode: 'manual', picks: ['id-b'] })).toEqual(rows);
  });
});

describe('directoryItem -- a record as a Website Builder section item', () => {
  /* T-M2-web. A testimonial has no name or title: the student is the
     attribution, so the card had an empty name above the quote. */
  it("maps a testimonial's attribution to the name, its note to the role and its quote to the text", () => {
    const item = directoryItem('TESTIMONIALS', {
      id: 'q-1',
      quote: 'Clear advice at every step.',
      attribution: 'Aarti Nair',
      attributionNote: 'Master’s applicant',
      imageMedia: null,
    });
    expect(item).toMatchObject({
      id: 'q-1',
      slug: '',
      href: null,
      title: 'Aarti Nair',
      quote: { text: 'Clear advice at every step.', name: 'Aarti Nair', role: 'Master’s applicant' },
    });
  });

  /* SS-C7. Stories had no link and printed their journey's raw <p> tags. */
  it("links a success story and gives a plain, variable-resolved excerpt of its journey", () => {
    const item = directoryItem('SUCCESS_STORIES', {
      id: 's-1',
      slug: 'from-pune-to-tokyo',
      title: 'From Pune to Tokyo',
      journey: `<p>At {universityName} I learnt to apply early.</p><p>${'Then the visa. '.repeat(20)}</p>`,
      university: { name: 'The University of Tokyo' },
    });
    expect(item.href).toBe('/success-stories/from-pune-to-tokyo');
    expect(item.title).toBe('From Pune to Tokyo');
    expect(item.description.startsWith('At The University of Tokyo I learnt to apply early. Then the visa.')).toBe(true);
    expect(item.description).not.toMatch(/[<>{}]/);
    expect(item.description.length).toBeLessThanOrEqual(180);
    expect(item.description.endsWith('…')).toBe(true);
  });

  it('keeps the other directories as they were', () => {
    expect(
      directoryItem('UNIVERSITY_DIRECTORY', { id: 'u', slug: 'kyoto', name: 'Kyoto University', shortDescription: 'In Kyoto.' }),
    ).toMatchObject({ slug: 'kyoto', title: 'Kyoto University', description: 'In Kyoto.', href: '/universities/kyoto' });
  });
});

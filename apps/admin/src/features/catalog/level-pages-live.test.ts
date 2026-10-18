import { describe, expect, it } from 'vitest';
import { levelSlug, liveLevelRows } from './level-pages';
import type { LevelPageRow, LevelRef } from './catalog.types';

const ug: LevelRef = { id: 'lvl-ug', code: 'UG', name: "Bachelor's", slug: 'bachelors', description: null, status: 'ACTIVE' };
const pg: LevelRef = { id: 'lvl-pg', code: 'PG', name: "Master's", slug: 'masters', description: null, status: 'ACTIVE' };
const phd: LevelRef = { id: 'lvl-phd', code: 'PHD', name: 'PhD', slug: 'phd', description: null, status: 'ACTIVE' };
const diploma: LevelRef = { id: 'lvl-dip', code: 'DIP', name: 'Diploma', slug: 'diploma', description: null, status: 'ACTIVE' };
/* The active level list, in its own order. */
const levels = [ug, pg, phd, diploma];
const basePath = '/subjects/marine-sciences';

type Page = NonNullable<LevelPageRow['page']>;
const page = (overrides: Partial<Page> = {}): Page => ({
  id: 'page-1', status: 'DRAFT', hasIntro: true, hasAdmissionNote: false, hasCareersNote: false,
  faqCount: 1, hasSeo: false, searchReady: false, updatedAt: 'v1', ...overrides,
});
/* A row as the API sends it: offered because it is ticked, unless told otherwise. */
const row = (level: LevelRef, overrides: Partial<LevelPageRow> = {}): LevelPageRow => ({
  level, offered: true, sources: ['TICKED'], path: `${basePath}/${level.slug}`, page: null, ...overrides,
});
const live = (rows: LevelPageRow[], ticked: string[], savedTicked: string[], more: { levels?: typeof levels; basePath?: string | null } = {}) =>
  liveLevelRows({ rows, levels: more.levels ?? levels, ticked, savedTicked, basePath: more.basePath === undefined ? basePath : more.basePath });
const summary = (rows: ReturnType<typeof liveLevelRows>) => rows.map((item) => [item.level.name, item.state, item.unsaved]);

describe('levelSlug', () => {
  it('takes the slug the level list sends', () => {
    expect(levelSlug({ code: 'PG', slug: 'postgraduate' })).toBe('postgraduate');
  });

  it('falls back to the API’s own names for a list read before it sent one', () => {
    expect(levelSlug({ code: 'UG' })).toBe('bachelors');
    expect(levelSlug({ code: 'PG' })).toBe('masters');
    expect(levelSlug({ code: 'PHD' })).toBe('phd');
    expect(levelSlug({ code: 'pg' })).toBe('masters');
    expect(levelSlug({ code: 'PG', slug: '' })).toBe('masters');
    expect(levelSlug({ code: 'DIP' })).toBe('dip');
  });
});

/**
 * The Level pages card's rows as the study-level ticks stand now. The API
 * says what is offered as saved; the ticks say what the editor is about to
 * save. Only a level's own tick moves: a level a specialization or a course
 * brings in stays offered whatever its tick.
 */
describe('liveLevelRows', () => {
  it('keeps a row as the API sent it while its tick is as saved', () => {
    const stored = row(ug, { sources: ['TICKED', 'COURSES'], page: page() });
    expect(live([stored], ['lvl-ug'], ['lvl-ug'])).toEqual([
      {
        level: { id: 'lvl-ug', name: "Bachelor's" },
        path: '/subjects/marine-sciences/bachelors',
        page: stored.page,
        offered: true,
        sources: ['TICKED', 'COURSES'],
        state: 'saved',
        unsaved: false,
      },
    ]);
  });

  it('adds a level just ticked, with the address it will have', () => {
    expect(live([row(ug)], ['lvl-ug', 'lvl-phd'], ['lvl-ug'])).toEqual([
      expect.objectContaining({ level: { id: 'lvl-ug', name: "Bachelor's" }, state: 'saved', unsaved: false }),
      {
        level: { id: 'lvl-phd', name: 'PhD' },
        path: '/subjects/marine-sciences/phd',
        page: null,
        offered: false,
        sources: ['TICKED'],
        state: 'new',
        unsaved: true,
      },
    ]);
  });

  it('gives a level just ticked no address while the record has no slug', () => {
    const [added] = live([], ['lvl-pg'], [], { basePath: null });
    expect(added).toMatchObject({ level: { id: 'lvl-pg', name: "Master's" }, state: 'new', path: null });
  });

  it('builds the address from the level’s code when the list sent no slug', () => {
    const [added] = live([], ['lvl-pg'], [], { levels: [{ ...pg, slug: '' }] });
    expect(added.path).toBe('/subjects/marine-sciences/masters');
  });

  it('marks a level offered only by its tick, now unticked, as leaving', () => {
    const [leaving] = live([row(ug, { page: page() })], [], ['lvl-ug']);
    expect(leaving).toMatchObject({ state: 'leaving', sources: [], offered: true, unsaved: true });
    /* What was written is still there to show and delete. */
    expect(leaving.page).toMatchObject({ id: 'page-1' });
  });

  it('keeps a level something else offers, whatever its tick', () => {
    const [unticked] = live([row(ug, { sources: ['TICKED', 'SPECIALIZATION'] })], [], ['lvl-ug']);
    expect(unticked).toMatchObject({ state: 'saved', sources: ['SPECIALIZATION'], offered: true, unsaved: true });

    const [ticked] = live([row(pg, { sources: ['COURSES'] })], ['lvl-pg'], []);
    expect(ticked).toMatchObject({ state: 'saved', sources: ['TICKED', 'COURSES'], unsaved: true });
  });

  it('names TICKED as a source exactly when the level is ticked now', () => {
    /* The API's sources say what was saved; a tick taken off and put back
       before saving is no change at all, so the row stays as it was sent. */
    expect(live([row(ug, { sources: ['COURSES', 'TICKED'] })], ['lvl-ug'], ['lvl-ug'])[0]).toMatchObject({
      sources: ['COURSES', 'TICKED'],
      unsaved: false,
    });
    expect(live([row(ug, { sources: ['COURSES'] })], [], [])[0]).toMatchObject({ sources: ['COURSES'], unsaved: false });
  });

  it('brings back a kept page whose level is ticked again', () => {
    const kept = row(phd, { offered: false, sources: [], page: page() });
    expect(live([kept], ['lvl-phd'], [])[0]).toMatchObject({ state: 'returning', sources: ['TICKED'], offered: false, unsaved: true });
    /* Left unticked, it stays a kept page, off the site. */
    expect(live([kept], [], [])[0]).toMatchObject({ state: 'saved', sources: [], offered: false, unsaved: false });
  });

  it('leaves a level that is not in the active list as the API sent it', () => {
    const retired: LevelRef = { id: 'lvl-old', code: 'OLD', name: 'Foundation', slug: 'foundation', description: null, status: 'INACTIVE' };
    const stored = row(retired, { page: page() });
    expect(live([stored], [], ['lvl-old'])).toEqual([
      expect.objectContaining({ level: { id: 'lvl-old', name: 'Foundation' }, sources: ['TICKED'], offered: true, state: 'saved', unsaved: false }),
    ]);
    /* A tick on a level no longer listed adds nothing. */
    expect(live([], ['lvl-gone'], [])).toEqual([]);
  });

  it('stays as the API sent it while the level list is empty', () => {
    const rows = [row(ug), row(phd, { offered: false, sources: [], page: page() })];
    expect(summary(live(rows, ['lvl-phd', 'lvl-pg'], ['lvl-ug'], { levels: [] }))).toEqual([
      ["Bachelor's", 'saved', false],
      ['PhD', 'saved', false],
    ]);
    expect(live(rows, ['lvl-phd'], ['lvl-ug'], { levels: [] })[0].sources).toEqual(['TICKED']);
  });

  it('marks unsaved only the rows whose tick moved', () => {
    const rows = [row(ug), row(pg, { sources: ['TICKED', 'COURSES'] }), row(phd, { sources: ['SPECIALIZATION'] })];
    expect(summary(live(rows, ['lvl-ug', 'lvl-phd'], ['lvl-ug', 'lvl-pg']))).toEqual([
      ["Bachelor's", 'saved', false],
      ["Master's", 'saved', true],
      ['PhD', 'saved', true],
    ]);
  });

  it('lists what will be offered first, each part in the levels’ own order', () => {
    const retired: LevelRef = { id: 'lvl-old', code: 'OLD', name: 'Foundation', slug: 'foundation', description: null, status: 'INACTIVE' };
    const rows = [
      row(phd),
      row(diploma, { offered: false, sources: [], page: page() }),
      row(retired),
      row(ug, { sources: ['COURSES'] }),
    ];
    /* PhD is unticked (leaving), Master's just ticked (new); the retired
       level is still offered as stored, after every listed one. */
    expect(summary(live(rows, ['lvl-pg'], ['lvl-phd']))).toEqual([
      ["Bachelor's", 'saved', false],
      ["Master's", 'new', true],
      ['Foundation', 'saved', false],
      ['PhD', 'leaving', true],
      ['Diploma', 'saved', false],
    ]);
  });

  it('puts a returning page back among the offered ones', () => {
    const rows = [row(ug), row(pg, { offered: false, sources: [], page: page() })];
    expect(summary(live(rows, ['lvl-ug', 'lvl-pg'], ['lvl-ug']))).toEqual([
      ["Bachelor's", 'saved', false],
      ["Master's", 'returning', true],
    ]);
    expect(summary(live([row(pg, { offered: false, sources: [], page: page() }), row(ug)], ['lvl-ug'], ['lvl-ug']))).toEqual([
      ["Bachelor's", 'saved', false],
      ["Master's", 'saved', false],
    ]);
  });

  it('leaves the rows it was given untouched', () => {
    const rows = [row(ug, { sources: ['TICKED', 'COURSES'] })];
    live(rows, [], ['lvl-ug']);
    expect(rows[0].sources).toEqual(['TICKED', 'COURSES']);
  });
});

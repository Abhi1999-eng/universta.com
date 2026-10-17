import { describe, expect, it } from 'vitest';
import { indexableLevelPaths, programmeTally } from './level-page-index';
import type { ProgrammeAddress } from './phase1';

const address = (over: Partial<ProgrammeAddress>): ProgrammeAddress => ({
  slug: 'programme',
  universitySlug: 'warwick',
  countrySlug: 'united-kingdom',
  updatedAt: '2026-10-05T00:00:00.000Z',
  ...over,
});
const catalogue = ['FOUNDATION', 'PATHWAY', 'UG', 'PG', 'MBA', 'PHD'].map((code) => ({ code }));
const UG = { code: 'UG' };
const PG = { code: 'PG' };

describe('the programmes behind each level page', () => {
  it('counts a programme on its subject’s page and on its specialization’s', () => {
    const tally = programmeTally([
      address({ subjectSlug: 'computing', specializationSlug: 'ai', levelCode: 'pg' }),
      address({ subjectSlug: 'computing', specializationSlug: null, levelCode: 'PG' }),
    ]);
    expect(tally.get('computing||PG')).toBe(2);
    expect(tally.get('computing|ai|PG')).toBe(1);
  });

  it('skips a programme that does not say its subject or level', () => {
    const tally = programmeTally([
      address({ subjectSlug: null, levelCode: 'PG' }),
      address({ subjectSlug: 'computing', levelCode: null }),
      address({}),
    ]);
    expect(tally.size).toBe(0);
  });
});

describe('the level pages worth announcing', () => {
  const paths = (input: Partial<Parameters<typeof indexableLevelPaths>[0]>) =>
    indexableLevelPaths({
      subjects: [],
      specializations: [],
      catalogue,
      tally: new Map(),
      written: { rows: [], templateRobotsIndex: null },
      ...input,
    }).map((row) => row.path);

  it('announces a page with three programmes and not with two', () => {
    const subjects = [{ slug: 'computing', levels: [UG, PG] }];
    expect(paths({ subjects, tally: new Map([['computing||UG', 3], ['computing||PG', 2]]) })).toEqual([
      '/subjects/computing/bachelors',
    ]);
  });

  it('announces a specialization’s page from its own count, at its readable address', () => {
    const specializations = [{ slug: 'ai', subject: { slug: 'computing' }, levels: [PG] }];
    expect(paths({ specializations, tally: new Map([['computing|ai|PG', 3]]) })).toEqual([
      '/subjects/computing/ai/masters',
    ]);
  });

  it('never announces the six levels a field offered at nothing shows', () => {
    const subjects = [{ slug: 'history', levels: [] }];
    expect(paths({ subjects, tally: new Map([['history||FOUNDATION', 9]]) })).toEqual([]);
  });

  it('announces only levels the catalogue lists', () => {
    const subjects = [{ slug: 'computing', levels: [{ code: 'DIPLOMA' }, UG] }];
    const tally = new Map([['computing||DIPLOMA', 9], ['computing||UG', 9]]);
    expect(paths({ subjects, tally })).toEqual(['/subjects/computing/bachelors']);
  });

  it('announces a written page with nothing listed, dated by its last change', () => {
    const subjects = [{ slug: 'computing', levels: [PG] }];
    const rows = indexableLevelPaths({
      subjects,
      specializations: [],
      catalogue,
      tally: new Map(),
      written: {
        rows: [{
          path: '/subjects/computing/masters', subjectSlug: 'computing', specializationSlug: null,
          levelCode: 'PG', levelSlug: 'masters', hasOwnContent: true, robotsIndex: null,
          updatedAt: '2026-10-16T00:00:00.000Z',
        }],
        templateRobotsIndex: null,
      },
    });
    expect(rows).toEqual([{ path: '/subjects/computing/masters', lastModified: '2026-10-16T00:00:00.000Z' }]);
  });

  it('leaves out a page whose robots setting says no, and the unwritten ones the template says no for', () => {
    const subjects = [{ slug: 'computing', levels: [UG, PG] }];
    const tally = new Map([['computing||UG', 5], ['computing||PG', 5]]);
    const row = {
      path: '/subjects/computing/bachelors', subjectSlug: 'computing', specializationSlug: null,
      levelCode: 'UG', levelSlug: 'bachelors', hasOwnContent: false, robotsIndex: false as boolean | null,
      updatedAt: '2026-10-16T00:00:00.000Z',
    };
    expect(paths({ subjects, tally, written: { rows: [row], templateRobotsIndex: null } })).toEqual([
      '/subjects/computing/masters',
    ]);
    expect(
      paths({ subjects, tally, written: { rows: [{ ...row, robotsIndex: true }], templateRobotsIndex: false } }),
    ).toEqual(['/subjects/computing/bachelors']);
  });

  /* Without the written pages no page's robots setting is known, and one
     that says noindex would go out on its programmes alone. */
  it('announces none while the written pages cannot be read', () => {
    const subjects = [{ slug: 'computing', levels: [UG] }];
    const tally = new Map([['computing||UG', 5]]);
    expect(paths({ subjects, tally })).toEqual(['/subjects/computing/bachelors']);
    expect(paths({ subjects, tally, written: null })).toEqual([]);
  });

  it('announces each page once', () => {
    const subjects = [{ slug: 'computing', levels: [UG] }, { slug: 'computing', levels: [UG] }];
    expect(paths({ subjects, tally: new Map([['computing||UG', 3]]) })).toEqual(['/subjects/computing/bachelors']);
  });
});

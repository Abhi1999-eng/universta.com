import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * What the universities list tells a directory card.
 *
 * The card in the approved build says where a university is ("Oxford,
 * United Kingdom") and what it is strong in, and its list filters by city.
 * The list returned each campus as a bare id and nothing about subjects, so
 * the public lists could say "United Kingdom" about Oxford and nothing at
 * all about what it teaches.
 */

type Row = Record<string, unknown>;

function service(rows: Row[], tallies: Row[] = []) {
  const listArgs: Row[] = [];
  const subjectReads: Array<{ sql: string; values: unknown[] }> = [];
  const offeringReads: Row[] = [];
  const prisma = {
    university: {
      findMany: async (args: Row) => {
        listArgs.push(args);
        return rows;
      },
      count: async () => rows.length,
    },
    universityCourseOffering: {
      findMany: async (args: Row) => {
        offeringReads.push(args);
        return [];
      },
    },
    $queryRaw: async (query: { sql: string; values: unknown[] }) => {
      subjectReads.push({ sql: query.sql, values: query.values });
      return tallies;
    },
  } as unknown as PrismaService;
  return {
    svc: new ExpandedService(prisma, {} as ExperimentsService),
    listArgs,
    subjectReads,
    offeringReads,
  };
}

const university = (over: Row = {}): Row => ({
  id: 'u1',
  name: 'University of Oxford',
  slug: 'university-of-oxford',
  campuses: [],
  _count: { offerings: 0 },
  ...over,
});

/* One row of the per-university, per-subject count the database returns.
   MySQL hands COUNT(*) back as a BIGINT. */
const tally = (
  universityId: string,
  name: string,
  slug: string,
  offerings: number,
): Row => ({ universityId, name, slug, offerings: BigInt(offerings) });

describe('the universities list, for a directory card', () => {
  it('reports each campus city, the typed one first and the catalogue city after', async () => {
    const { svc, listArgs } = service([
      university({
        campuses: [
          { id: 'c1', city: 'Oxford', cityRef: { name: 'Oxford' } },
          { id: 'c2', city: null, cityRef: { name: 'Swindon' } },
          { id: 'c3', city: '  ', cityRef: null },
        ],
      }),
    ]);
    const result = await svc.list('universities', {
      page: 1,
      limit: 12,
    } as never);

    expect((result.data[0] as Row).campuses).toEqual([
      { id: 'c1', city: 'Oxford' },
      { id: 'c2', city: 'Swindon' },
      { id: 'c3', city: null },
    ]);
    /* In display order, so the first campus is the one a card names. */
    const include = listArgs[0]?.include as { campuses: Row };
    expect(include.campuses.orderBy).toEqual([
      { displayOrder: 'asc' },
      { name: 'asc' },
    ]);
  });

  it('names the subjects each one teaches, most published programmes first', async () => {
    const { svc } = service(
      [university(), university({ id: 'u2', slug: 'imperial-college-london' })],
      [
        tally('u1', 'Law', 'law', 1),
        tally('u1', 'History', 'history', 2),
        tally('u1', 'Classics', 'classics', 1),
        tally('u2', 'Engineering', 'engineering', 1),
      ],
    );
    const result = await svc.list('universities', {
      page: 1,
      limit: 12,
    } as never);

    expect((result.data[0] as Row).subjects).toEqual([
      { name: 'History', slug: 'history', offerings: 2 },
      { name: 'Classics', slug: 'classics', offerings: 1 },
      { name: 'Law', slug: 'law', offerings: 1 },
    ]);
    expect((result.data[1] as Row).subjects).toEqual([
      { name: 'Engineering', slug: 'engineering', offerings: 1 },
    ]);
  });

  it('counts the subjects in the database, not by reading every offering', async () => {
    /* Every page of every list paid for a read of all its universities'
       published offerings, tallied here. The database now answers with
       one row per university and subject, in one read for the page. */
    const { svc, subjectReads, offeringReads } = service([
      university(),
      university({ id: 'u2', slug: 'imperial-college-london' }),
    ]);
    await svc.list('universities', { page: 1, limit: 12 } as never);

    expect(offeringReads).toHaveLength(0);
    expect(subjectReads).toHaveLength(1);
    const { sql, values } = subjectReads[0];
    expect(sql).toMatch(/COUNT\(\*\)/);
    expect(sql).toMatch(/GROUP BY o\.university_id, s\.id/);
    /* Only published programmes inside their window, under a published
       subject -- the same programmes the card's count is of. */
    expect(sql).toContain("o.status = 'PUBLISHED'");
    expect(sql).toContain('o.deleted_at IS NULL');
    expect(sql).toMatch(/o\.publish_starts_at <= \?/);
    expect(sql).toMatch(/o\.publish_ends_at > \?/);
    expect(sql).toContain("s.status = 'PUBLISHED'");
    expect(sql).toContain('s.deleted_at IS NULL');
    expect(values.slice(0, 2)).toEqual(['u1', 'u2']);
  });

  it('gives a university with no published programme an empty list, not a missing one', async () => {
    const { svc } = service([university()]);
    const result = await svc.list('universities', {
      page: 1,
      limit: 12,
    } as never);
    expect((result.data[0] as Row).subjects).toEqual([]);
  });

  it('does not ask about subjects for an empty page', async () => {
    const { svc, subjectReads } = service([]);
    await svc.list('universities', { page: 1, limit: 12 } as never);
    expect(subjectReads).toHaveLength(0);
  });

  it('orders ranked first, then by name, when asked', async () => {
    const { svc, listArgs } = service([]);
    await svc.list('universities', {
      page: 1,
      limit: 12,
      sort: 'ranking',
    } as never);
    expect(listArgs[0]?.orderBy).toEqual([
      { qsRanking: { sort: 'asc', nulls: 'last' } },
      { name: 'asc' },
    ]);
  });
});

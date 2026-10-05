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

function service(rows: Row[], offerings: Row[] = []) {
  const listArgs: Row[] = [];
  const offeringArgs: Row[] = [];
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
        offeringArgs.push(args);
        return offerings;
      },
    },
  } as unknown as PrismaService;
  return {
    svc: new ExpandedService(prisma, {} as ExperimentsService),
    listArgs,
    offeringArgs,
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

const offering = (universityId: string, name: string, slug: string): Row => ({
  universityId,
  genericCourse: { subject: { name, slug } },
});

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
    const { svc, offeringArgs } = service(
      [university(), university({ id: 'u2', slug: 'imperial-college-london' })],
      [
        offering('u1', 'Law', 'law'),
        offering('u1', 'History', 'history'),
        offering('u1', 'History', 'history'),
        offering('u1', 'Classics', 'classics'),
        offering('u2', 'Engineering', 'engineering'),
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
    /* One read for the page, counting only published programmes under a
       published subject -- the same programmes the card's count is of. */
    expect(offeringArgs).toHaveLength(1);
    const where = offeringArgs[0]?.where as Row;
    expect(where.universityId).toEqual({ in: ['u1', 'u2'] });
    expect(where.status).toBe('PUBLISHED');
    expect(where.genericCourse).toEqual({
      subject: { status: 'PUBLISHED', deletedAt: null },
    });
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
    const { svc, offeringArgs } = service([]);
    await svc.list('universities', { page: 1, limit: 12 } as never);
    expect(offeringArgs).toHaveLength(0);
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

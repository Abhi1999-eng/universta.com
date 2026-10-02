import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * A university is only a study destination while its country is one.
 *
 * Deleting a destination left its universities listed on /universities and
 * reachable at their own URLs, where the page named the country in its
 * breadcrumb and in "Institution facts" -- a country the site had just
 * stopped having. The list already required a live country whenever someone
 * filtered by one; it asked for nothing when nobody had.
 */

function service(total = 0) {
  const listArgs: Array<Record<string, unknown>> = [];
  const countArgs: Array<Record<string, unknown>> = [];
  const detailArgs: Array<Record<string, unknown>> = [];
  const prisma = {
    university: {
      findMany: async (args: Record<string, unknown>) => {
        listArgs.push(args);
        return [];
      },
      /* The listing counts and pages in the database now, so the double
         has to answer both halves of that. */
      count: async (args: Record<string, unknown>) => {
        countArgs.push(args);
        return total;
      },
      findFirst: async (args: Record<string, unknown>) => {
        detailArgs.push(args);
        return null;
      },
    },
    seoMetadata: { findUnique: async () => null },
    mediaAsset: { findMany: async () => [] },
  } as unknown as PrismaService;
  return {
    svc: new ExpandedService(prisma, {} as ExperimentsService),
    listArgs,
    countArgs,
    detailArgs,
  };
}

const liveCountry = { status: 'PUBLISHED', deletedAt: null };

describe('public universities and their country', () => {
  it('lists only universities whose country is still published', async () => {
    const { svc, listArgs } = service();
    await svc.list('universities', { page: 1, limit: 12 } as never);

    const where = listArgs[0]?.where as { country?: unknown };
    expect(where?.country).toEqual(liveCountry);
  });

  it('keeps the same rule when a country filter is supplied', async () => {
    const { svc, listArgs } = service();
    await svc.list('universities', {
      page: 1,
      limit: 12,
      country: 'canada',
    } as never);

    const where = listArgs[0]?.where as {
      country?: { slug?: string; status?: string; deletedAt?: null };
    };
    expect(where?.country?.slug).toBe('canada');
    expect(where?.country?.status).toBe('PUBLISHED');
    expect(where?.country?.deletedAt).toBeNull();
  });

  it('does not serve a detail page for one whose country is gone', async () => {
    const { svc, detailArgs } = service();
    await svc.detail('universities', 'some-university').catch(() => undefined);

    const where = detailArgs[0]?.where as { country?: unknown };
    expect(where?.country).toEqual(liveCountry);
  });
});

/**
 * The listing used to read the first 500 rows, sort them in memory and cut
 * a page out of that. With twenty universities nobody could tell; with
 * 9,761 everything past the five hundredth was unreachable and `meta.total`
 * said 500 whatever the real number was.
 */
describe('the universities listing pages in the database', () => {
  it('asks for one page rather than a capped block', async () => {
    const { svc, listArgs } = service(9761);
    await svc.list('universities', { page: 3, limit: 12 } as never);

    expect(listArgs[0]).toMatchObject({ skip: 24, take: 12 });
    expect(listArgs[0]).not.toHaveProperty('cursor');
    // The old behaviour, named so a reintroduction fails here.
    expect(listArgs[0]?.take).not.toBe(500);
  });

  it('reports the real total, not the size of what it read', async () => {
    const { svc } = service(9761);
    const result = await svc.list('universities', {
      page: 1,
      limit: 12,
    } as never);

    expect((result.meta as { total: number }).total).toBe(9761);
  });

  it('counts against the same conditions it lists against', async () => {
    const { svc, listArgs, countArgs } = service(42);
    await svc.list('universities', {
      page: 1,
      limit: 12,
      country: 'canada',
    } as never);

    expect(countArgs[0]?.where).toEqual(listArgs[0]?.where);
  });

  it('orders by display order then name, and honours the sorts the screen offers', async () => {
    const order = async (sort?: string) => {
      const { svc, listArgs } = service();
      await svc.list('universities', { page: 1, limit: 12, sort } as never);
      return listArgs[0]?.orderBy;
    };

    expect(await order()).toEqual([{ displayOrder: 'asc' }, { name: 'asc' }]);
    expect(await order('name-asc')).toEqual([{ name: 'asc' }]);
    expect(await order('name-desc')).toEqual([{ name: 'desc' }]);
    expect(await order('newest')).toEqual([
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ]);
  });
});

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

function service() {
  const listArgs: Array<Record<string, unknown>> = [];
  const detailArgs: Array<Record<string, unknown>> = [];
  const prisma = {
    university: {
      findMany: async (args: Record<string, unknown>) => {
        listArgs.push(args);
        return [];
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

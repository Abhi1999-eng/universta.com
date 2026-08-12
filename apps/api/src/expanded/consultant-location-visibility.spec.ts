import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/** A consultant location is a public page, so the consultants it lists are
 * public too. This asserts the relation is filtered at query time — a draft or
 * scheduled-out profile must never reach the payload, because the page renders
 * its name and links to a detail route that correctly 404s. */

function service() {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    consultantLocation: {
      findFirst: async (args: Record<string, unknown>) => {
        calls.push(args);
        return {
          id: 'location-1',
          name: 'Demo Harbour',
          slug: 'demo-harbour',
          status: 'ACTIVE',
          deletedAt: null,
          country: { id: 'country-1', name: 'Canada', slug: 'canada' },
          consultants: [],
        };
      },
    },
    seoMetadata: { findUnique: async () => null },
    mediaAsset: { findMany: async () => [] },
  } as unknown as PrismaService;
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), calls };
}

describe('ExpandedService consultant locations', () => {
  it('only includes consultants that are published and inside their window', async () => {
    const { svc, calls } = service();
    await svc.consultantLocation('demo-harbour');

    const include = calls[0]?.include as {
      consultants?: { where?: { consultant?: Record<string, unknown> } };
    };
    const where = include?.consultants?.where?.consultant;

    expect(where).toBeDefined();
    expect(where?.status).toBe('PUBLISHED');
    expect(where?.deletedAt).toBeNull();
    // The scheduling window is what stops a published-but-not-yet-live or an
    // expired profile from appearing.
    expect(where?.AND).toEqual([
      {
        OR: [
          { publishStartsAt: null },
          { publishStartsAt: { lte: expect.any(Date) } },
        ],
      },
      {
        OR: [
          { publishEndsAt: null },
          { publishEndsAt: { gt: expect.any(Date) } },
        ],
      },
    ]);
  });

  it('still scopes the location itself to active, undeleted records', async () => {
    const { svc, calls } = service();
    await svc.consultantLocation('demo-harbour');

    expect(calls[0]?.where).toEqual({
      slug: 'demo-harbour',
      status: 'ACTIVE',
      deletedAt: null,
    });
  });
});

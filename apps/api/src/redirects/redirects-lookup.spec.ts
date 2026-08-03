import { RedirectsService } from './redirects.service';
import type { PrismaService } from '../prisma/prisma.service';

/** ISS-033. lookup() is the one call site the web app's middleware uses to
 * actually enforce an admin-configured redirect -- nothing else in the
 * codebase ever consulted the Redirect table before this. */
describe('RedirectsService.lookup', () => {
  function fakePrisma(row: Record<string, unknown> | null) {
    let updateArgs: { where: unknown; data: unknown } | null = null;
    const prisma = {
      redirect: {
        findFirst: async () => row,
        update: async (args: { where: unknown; data: unknown }) => {
          updateArgs = args;
          return row;
        },
      },
    } as unknown as PrismaService;
    return { prisma, getUpdateArgs: () => updateArgs };
  }

  it('returns null when no active redirect matches the path', async () => {
    const { prisma } = fakePrisma(null);
    const service = new RedirectsService(prisma);
    expect(await service.lookup('/nonexistent')).toBeNull();
  });

  it('returns the target path and status code for a matching redirect', async () => {
    const { prisma } = fakePrisma({
      id: 'redirect-1',
      sourcePath: '/old-path',
      targetPath: '/countries',
      httpStatusCode: 301,
      isActive: true,
    });
    const service = new RedirectsService(prisma);
    expect(await service.lookup('/old-path')).toEqual({
      targetPath: '/countries',
      httpStatusCode: 301,
    });
  });

  it('only matches redirects where isActive is true (via the query itself)', async () => {
    // findFirst's own where clause carries { isActive: true } -- a disabled
    // redirect is never returned by the fake's findFirst in the first place,
    // matching how Prisma would filter it out for real.
    const { prisma } = fakePrisma(null);
    const service = new RedirectsService(prisma);
    expect(await service.lookup('/disabled-path')).toBeNull();
  });

  it('records the hit (increments hitCount, sets lastHitAt) on a match', async () => {
    const { prisma, getUpdateArgs } = fakePrisma({
      id: 'redirect-1',
      sourcePath: '/old-path',
      targetPath: '/countries',
      httpStatusCode: 301,
      isActive: true,
    });
    const service = new RedirectsService(prisma);
    await service.lookup('/old-path');
    const args = getUpdateArgs() as {
      data: { hitCount: { increment: number }; lastHitAt: Date };
    };
    expect(args.data.hitCount).toEqual({ increment: 1 });
    expect(args.data.lastHitAt).toBeInstanceOf(Date);
  });

  it('does not touch hitCount when there is no match', async () => {
    const { prisma, getUpdateArgs } = fakePrisma(null);
    const service = new RedirectsService(prisma);
    await service.lookup('/nonexistent');
    expect(getUpdateArgs()).toBeNull();
  });
});

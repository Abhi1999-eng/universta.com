import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/** ISS-023. `Page.pageType` has no default in the schema, and 'pages' was
 * the only resource in `writeData` with no whitelist entry -- so every body
 * key reached Prisma unfiltered, and a create that omitted `pageType`
 * crashed with an unhandled PrismaClientValidationError (a raw 500) instead
 * of a normal, named 422. Reproduced live: POST /admin/phase1/pages with
 * {title, slug, shortDescription} and no pageType returned "Internal server
 * error". */

type Row = Record<string, unknown>;

function fakePrisma() {
  let nextId = 1;
  const created: Row[] = [];
  const pages: Row[] = [
    { id: 'page-1', title: 'Existing', slug: 'existing', deletedAt: null },
  ];
  return {
    page: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `page-${nextId++}`, ...data };
        created.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: { id: string } }) =>
        pages.find((page) => page.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = pages.find((page) => page.id === where.id);
        Object.assign(row!, data);
        return row;
      },
    },
    seoMetadata: {
      upsert: async () => ({}),
      findUnique: async () => null,
    },
    _created: created,
  } as unknown as PrismaService & { _created: Row[] };
}

function service() {
  const prisma = fakePrisma();
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), prisma };
}

describe('ExpandedService.adminCreate — pages', () => {
  it('rejects a page create with no pageType, naming the field', async () => {
    const { svc } = service();
    await expect(
      svc.adminCreate('pages', {
        title: 'About',
        slug: 'about',
        shortDescription: 'probe',
      }),
    ).rejects.toMatchObject({ response: { code: 'PAGE_TYPE_REQUIRED' } });
  });

  it('creates a page once pageType is present, writing only whitelisted fields', async () => {
    const { svc, prisma } = service();
    const created = await svc.adminCreate('pages', {
      pageType: 'EDITORIAL',
      title: 'About',
      slug: 'about',
      shortDescription: 'probe',
      // Not a real Page column -- must never reach Prisma's create call.
      notAPageField: 'should be dropped',
    });
    expect(created).toMatchObject({
      pageType: 'EDITORIAL',
      title: 'About',
      slug: 'about',
    });
    expect(prisma._created[0]).not.toHaveProperty('notAPageField');
  });

  it('still allows the page-scheduling fields the CMS editor writes on every save', async () => {
    const { svc, prisma } = service();
    await svc.adminCreate('pages', {
      pageType: 'EDITORIAL',
      title: 'Scheduled page',
      slug: 'scheduled-page',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-30T00:00:00.000Z',
    });
    expect(prisma._created[0]).toMatchObject({
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-30T00:00:00.000Z',
    });
  });

  it('does not require pageType on a partial update', async () => {
    const { svc } = service();
    await expect(
      svc.adminUpdate('pages', 'page-1', {
        shortDescription: 'updated',
      }),
    ).resolves.toBeDefined();
  });
});

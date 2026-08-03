import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/** ISS-037. Neither the featuredFrom/featuredUntil window nor the
 * publishStartsAt/publishEndsAt window had any ordering check -- unlike
 * events' startsAt/endsAt, which already rejects an inverted pair. An
 * inverted window saved silently and then could never be true at any point
 * in time: isEffectivelyFeatured() and publishedWhereScheduled() both require
 * `now` to fall inside [start, end), so a record with end before start would
 * never be effectively featured, or never publicly visible, at all -- with
 * no error at save time to explain why. Reproduced live via the admin API
 * against a "consultants" record before this fix. */

type Row = Record<string, unknown>;

function fakePrisma() {
  const created: Row[] = [];
  return {
    consultant: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: 'consultant-1', ...data };
        created.push(row);
        return row;
      },
    },
    seoMetadata: { upsert: async () => ({}), findUnique: async () => null },
    _created: created,
  } as unknown as PrismaService & { _created: Row[] };
}

function service() {
  const prisma = fakePrisma();
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), prisma };
}

describe('ExpandedService.adminCreate — scheduling window ordering', () => {
  it('rejects a featuredUntil at or before featuredFrom', async () => {
    const { svc } = service();
    await expect(
      svc.adminCreate('consultants', {
        name: 'Test Consultancy',
        slug: 'test-consultancy',
        isFeatured: true,
        featuredFrom: '2026-09-10T00:00:00.000Z',
        featuredUntil: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: { code: 'FEATURED_DATE_RANGE_INVALID' },
    });
  });

  it('rejects a publishEndsAt at or before publishStartsAt', async () => {
    const { svc } = service();
    await expect(
      svc.adminCreate('consultants', {
        name: 'Test Consultancy',
        slug: 'test-consultancy',
        publishStartsAt: '2026-09-10T00:00:00.000Z',
        publishEndsAt: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PUBLISH_DATE_RANGE_INVALID' },
    });
  });

  it('still allows a correctly-ordered window through to create', async () => {
    const { svc, prisma } = service();
    await svc.adminCreate('consultants', {
      name: 'Test Consultancy',
      slug: 'test-consultancy',
      isFeatured: true,
      featuredFrom: '2026-09-01T00:00:00.000Z',
      featuredUntil: '2026-09-10T00:00:00.000Z',
      publishStartsAt: '2026-09-01T00:00:00.000Z',
      publishEndsAt: '2026-09-10T00:00:00.000Z',
    });
    expect(prisma._created[0]).toMatchObject({
      featuredFrom: new Date('2026-09-01T00:00:00.000Z'),
      featuredUntil: new Date('2026-09-10T00:00:00.000Z'),
      publishStartsAt: new Date('2026-09-01T00:00:00.000Z'),
      publishEndsAt: new Date('2026-09-10T00:00:00.000Z'),
    });
  });
});

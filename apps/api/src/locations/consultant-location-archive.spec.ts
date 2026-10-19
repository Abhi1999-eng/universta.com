import { LocationsService } from './locations.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * CON-C12. Archiving a consultant left its office rows behind, and they
 * kept counting: its location could not be archived ("1 consultant is
 * still linked") and the admin's Consultants column still showed 1, though
 * the consultant was on no list and no page.
 */

type Row = Record<string, unknown>;

const offices = [
  {
    locationId: 'location-1',
    consultant: { deletedAt: new Date('2026-10-01') },
  },
];

function service() {
  const calls: Row[] = [];
  const prisma = {
    consultantLocation: {
      findFirst: async () => ({ id: 'location-1', deletedAt: null }),
      findMany: async (args: Row) => {
        calls.push(args);
        return [];
      },
      update: async ({ data }: { data: Row }) => ({
        id: 'location-1',
        ...data,
      }),
    },
    seoMetadata: { findUnique: async () => null },
    consultantLocationMap: {
      /* Counts the way the database would, honouring the consultant filter. */
      count: async ({
        where,
      }: {
        where: { consultant?: { deletedAt: null } };
      }) =>
        offices.filter((row) =>
          where.consultant ? row.consultant.deletedAt === null : true,
        ).length,
    },
  } as unknown as PrismaService;
  return { svc: new LocationsService(prisma), calls };
}

describe('Archiving a consultant location', () => {
  it('is not blocked by a consultant that has been archived', async () => {
    const { svc } = service();
    await expect(
      svc.archiveConsultantLocation('location-1'),
    ).resolves.toMatchObject({
      status: 'ARCHIVED',
    });
  });

  it('counts only consultants still in the catalogue in the admin list', async () => {
    const { svc, calls } = service();
    await svc.adminListConsultantLocations({});
    expect(calls[0]).toMatchObject({
      include: {
        _count: {
          select: {
            consultants: { where: { consultant: { deletedAt: null } } },
          },
        },
      },
    });
  });
});

import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * CON-C5, CON-C9, CON-M4. A deactivated office stayed on profiles (linking
 * to its 404) and in the directory's city chips; a location page's cards
 * lost each consultant's own offices; and a consultant's image never left
 * the admin.
 */

type Row = Record<string, unknown>;
const live = {
  status: 'PUBLISHED',
  deletedAt: null,
  publishStartsAt: null,
  publishEndsAt: null,
  displayOrder: 0,
};
const office = (
  slug: string,
  status: string,
  deletedAt: Date | null = null,
) => ({
  consultantId: 'consultant-1',
  locationId: `location-${slug}`,
  address: `1 ${slug} Street`,
  location: {
    id: `location-${slug}`,
    name: slug,
    slug,
    city: slug,
    status,
    deletedAt,
    country: null,
  },
});
const consultant = {
  id: 'consultant-1',
  name: 'Demo Advisers',
  slug: 'demo-advisers',
  featuredMediaId: 'media-1',
  ...live,
  locations: [
    office('open-office', 'ACTIVE'),
    office('closed-office', 'INACTIVE'),
    office('archived-office', 'ARCHIVED', new Date('2026-10-01')),
  ],
  countries: [],
  services: [],
  languages: [],
};

/** Applies a `locations: { where }` include the way Prisma would. */
function officesFor(include: Row | undefined, row: Row) {
  const where = (include?.locations as { where?: { location?: Row } })?.where
    ?.location;
  const offices = row.locations as Array<{ location: Row }>;
  if (!where) return offices;
  return offices.filter((entry) =>
    Object.entries(where).every(
      ([key, value]) => entry.location[key] === value,
    ),
  );
}

function service() {
  const calls: Row[] = [];
  const read = (args: { include?: Row }) => {
    calls.push(args);
    return { ...consultant, locations: officesFor(args.include, consultant) };
  };
  const prisma = {
    consultant: {
      findMany: async (args: { include?: Row }) => [read(args)],
      findFirst: async (args: { include?: Row }) => read(args),
    },
    consultantLocation: {
      findFirst: async (args: { include: Row }) => {
        calls.push(args);
        const nested = (
          args.include.consultants as {
            include: { consultant: { include: Row } };
          }
        ).include.consultant.include;
        return {
          id: 'location-open-office',
          name: 'open-office',
          slug: 'open-office',
          status: 'ACTIVE',
          deletedAt: null,
          country: null,
          consultants: [
            {
              consultant: {
                ...consultant,
                locations: officesFor(nested, consultant),
              },
            },
          ],
        };
      },
    },
    mediaAsset: {
      findMany: async () => [
        {
          id: 'media-1',
          publicUrl: '/media/demo-advisers.png',
          altText: 'Demo Advisers logo',
          title: 'Logo',
        },
      ],
    },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), calls };
}

const slugs = (row: Row) =>
  (row.locations as Array<{ location: Row }>).map(
    (entry) => entry.location.slug,
  );

describe('ExpandedService public consultants', () => {
  it('lists only offices at active locations, everywhere a consultant appears', async () => {
    const { svc } = service();
    const [listed] = (await svc.list('consultants', {})).data as Row[];
    const detail = (await svc.detail('consultants', 'demo-advisers')) as Row;
    const compared = (await svc.compare('consultants', ['demo-advisers']))
      .items[0] as Row;
    const location = (await svc.consultantLocation('open-office')) as {
      consultants: Array<{ consultant: Row }>;
    };
    for (const row of [
      listed,
      detail,
      compared,
      location.consultants[0].consultant,
    ])
      expect(slugs(row)).toEqual(['open-office']);
  });

  it('keeps each office’s address', async () => {
    const { svc } = service();
    const detail = (await svc.detail(
      'consultants',
      'demo-advisers',
    )) as unknown as {
      locations: Array<Row>;
    };
    expect(detail.locations[0]).toMatchObject({
      address: '1 open-office Street',
    });
  });

  it('gives a location page’s cards each consultant’s offices', async () => {
    const { svc, calls } = service();
    await svc.consultantLocation('open-office');
    expect(calls[0]).toMatchObject({
      include: {
        consultants: {
          include: {
            consultant: {
              include: {
                locations: {
                  where: { location: { status: 'ACTIVE', deletedAt: null } },
                  include: { location: true },
                },
              },
            },
          },
        },
      },
    });
  });

  it('carries the consultant’s image on the list and the profile', async () => {
    const { svc } = service();
    const [listed] = (await svc.list('consultants', {})).data as Row[];
    const detail = (await svc.detail('consultants', 'demo-advisers')) as Row;
    for (const row of [listed, detail])
      expect(row.featuredMedia).toEqual({
        id: 'media-1',
        publicUrl: '/media/demo-advisers.png',
        altText: 'Demo Advisers logo',
        title: 'Logo',
      });
  });
});

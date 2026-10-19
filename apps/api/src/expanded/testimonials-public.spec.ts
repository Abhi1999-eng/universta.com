import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * T-C3, T-C6, T-C8. A testimonial's University and Course picks and its
 * photo were saved and then ignored everywhere: the public list returned
 * bare ids. And the detail route, which a testimonial has no use for,
 * asked the database for a slug column it does not have and answered 500.
 */

type Row = Record<string, unknown>;
const live = { status: 'PUBLISHED', deletedAt: null };
const scheduled = { ...live, publishStartsAt: null, publishEndsAt: null };

const testimonial = {
  id: 'testimonial-1',
  quote: 'A fictional demonstration quote.',
  attribution: 'Amara',
  attributionNote: 'MSc, Westbridge',
  countryId: 'country-1',
  universityId: 'university-1',
  offeringId: 'offering-1',
  imageMediaId: 'media-1',
  displayOrder: 0,
  country: { id: 'country-1', name: 'Japan', slug: 'japan', ...live },
  university: {
    id: 'university-1',
    name: 'Westbridge University',
    slug: 'westbridge-university',
    ...scheduled,
  },
  offering: {
    id: 'offering-1',
    name: 'MSc Demo Studies at Westbridge University',
    slug: 'msc-demo-studies',
    ...scheduled,
    university: {
      id: 'university-1',
      name: 'Westbridge University',
      slug: 'westbridge-university',
      ...scheduled,
      country: { slug: 'japan', ...live },
    },
    genericCourse: {
      id: 'course-1',
      name: 'Demo Studies',
      slug: 'demo-studies',
    },
  },
};

function service(rows: Row[] = [testimonial]) {
  const calls: Row[] = [];
  const prisma = {
    testimonial: {
      findMany: async (args: Row) => {
        calls.push(args);
        return rows;
      },
      count: async () => rows.length,
      findFirst: async () => {
        throw new Error('Unknown argument `slug`');
      },
    },
    mediaAsset: {
      findMany: async () => [
        {
          id: 'media-1',
          publicUrl: '/media/amara.jpg',
          altText: 'A fictional portrait',
          title: 'Amara',
        },
      ],
    },
  } as unknown as PrismaService;
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), calls };
}

describe('ExpandedService public testimonials', () => {
  it('names the country, university and course, and gives the photo', async () => {
    const { svc } = service();
    const [row] = (await svc.list('testimonials', {})).data as Row[];
    expect(row).toMatchObject({
      quote: testimonial.quote,
      attribution: 'Amara',
      attributionNote: 'MSc, Westbridge',
      countryId: 'country-1',
      universityId: 'university-1',
      offeringId: 'offering-1',
      displayOrder: 0,
    });
    expect(row.country).toEqual({
      id: 'country-1',
      name: 'Japan',
      slug: 'japan',
    });
    expect(row.university).toEqual({
      id: 'university-1',
      name: 'Westbridge University',
      slug: 'westbridge-university',
    });
    expect(row.offering).toEqual({
      id: 'offering-1',
      name: 'MSc Demo Studies at Westbridge University',
      slug: 'msc-demo-studies',
      university: {
        id: 'university-1',
        name: 'Westbridge University',
        slug: 'westbridge-university',
        country: { slug: 'japan' },
      },
      genericCourse: {
        id: 'course-1',
        name: 'Demo Studies',
        slug: 'demo-studies',
      },
    });
    expect(row.imageMedia).toEqual({
      id: 'media-1',
      publicUrl: '/media/amara.jpg',
      altText: 'A fictional portrait',
      title: 'Amara',
    });
  });

  it('names nothing that is not live, and no photo that is not there', async () => {
    const { svc } = service([
      {
        ...testimonial,
        imageMediaId: 'media-archived',
        country: { ...testimonial.country, status: 'DRAFT' },
        university: {
          ...testimonial.university,
          publishEndsAt: new Date('2020-01-01'),
        },
        offering: { ...testimonial.offering, deletedAt: new Date() },
      },
    ]);
    const [row] = (await svc.list('testimonials', {})).data as Row[];
    expect(row).toMatchObject({
      country: null,
      university: null,
      offering: null,
      imageMedia: null,
    });
  });

  it('searches the student’s name as well as the quote', async () => {
    const { svc, calls } = service();
    await svc.list('testimonials', { q: 'Amara' });
    expect(calls[0]).toMatchObject({
      where: {
        OR: [
          { quote: { contains: 'Amara' } },
          { attribution: { contains: 'Amara' } },
        ],
      },
    });
  });

  it('answers 404, not 500, for a testimonial page', async () => {
    const { svc } = service();
    await expect(
      svc.detail('testimonials', 'anything-at-all'),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOT_FOUND' },
    });
    await expect(
      svc.detail('testimonials', 'testimonial-1'),
    ).rejects.toMatchObject({
      status: 404,
    });
  });
});

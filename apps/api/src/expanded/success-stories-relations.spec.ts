import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

/**
 * SS-C2 and SS-C9. A story filed under a draft country printed that
 * country's name and linked to /study-abroad/<draft>, which answers 404.
 * The Programme card had no country to build the course's own address
 * from, so it went through a redirect.
 */

type Row = Record<string, unknown>;
const live = { status: 'PUBLISHED', deletedAt: null };
const scheduled = { ...live, publishStartsAt: null, publishEndsAt: null };

const story = {
  id: 'story-1',
  title: 'A demonstration story',
  slug: 'a-demonstration-story',
  journey: '<p>A fictional journey.</p>',
  featuredMediaId: null,
  country: {
    id: 'country-1',
    name: 'Should not change',
    slug: 'should-not-change',
    status: 'DRAFT',
    deletedAt: null,
  },
  university: {
    id: 'university-1',
    name: 'Demo University',
    slug: 'demo-university',
    ...scheduled,
  },
  offering: {
    id: 'offering-1',
    name: 'MEng Demo Engineering',
    slug: 'meng-demo-engineering',
    ...scheduled,
    university: {
      id: 'university-1',
      name: 'Demo University',
      slug: 'demo-university',
      ...scheduled,
      country: { slug: 'japan', ...live },
    },
    genericCourse: {
      id: 'course-1',
      name: 'Demo Engineering',
      slug: 'demo-engineering',
    },
  },
};

function service(row: Row = story) {
  const calls: Row[] = [];
  const prisma = {
    successStory: {
      findMany: async (args: Row) => {
        calls.push(args);
        return [row];
      },
      count: async () => 1,
      findFirst: async (args: Row) => {
        calls.push(args);
        return row;
      },
    },
    mediaAsset: { findMany: async () => [] },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
  return { svc: new ExpandedService(prisma, {} as ExperimentsService), calls };
}

describe('ExpandedService success stories and what they are filed under', () => {
  it('leaves out a draft country in the list and on the page', async () => {
    const { svc } = service();
    const [listed] = (await svc.list('success-stories', {})).data as Row[];
    const detail = (await svc.detail('success-stories', story.slug)) as Row;
    for (const row of [listed, detail]) {
      expect(row.country).toBeNull();
      expect(row.university).toEqual({
        id: 'university-1',
        name: 'Demo University',
        slug: 'demo-university',
      });
    }
  });

  it('gives the course’s university its country, for the course’s own address', async () => {
    const { svc } = service();
    const detail = (await svc.detail('success-stories', story.slug)) as Row;
    expect(detail.offering).toEqual({
      id: 'offering-1',
      name: 'MEng Demo Engineering',
      slug: 'meng-demo-engineering',
      university: {
        id: 'university-1',
        name: 'Demo University',
        slug: 'demo-university',
        country: { slug: 'japan' },
      },
      genericCourse: {
        id: 'course-1',
        name: 'Demo Engineering',
        slug: 'demo-engineering',
      },
    });
  });

  it('leaves out a university or course outside its publishing window', async () => {
    const { svc } = service({
      ...story,
      university: {
        ...story.university,
        publishStartsAt: new Date('2999-01-01'),
      },
      offering: {
        ...story.offering,
        university: {
          ...story.offering.university,
          status: 'DRAFT',
        },
      },
    });
    const detail = (await svc.detail('success-stories', story.slug)) as Row;
    expect(detail.university).toBeNull();
    expect(detail.offering).toMatchObject({
      slug: 'meng-demo-engineering',
      university: null,
    });
  });

  it('leaves out an unpublished country of the course’s university', async () => {
    const { svc } = service({
      ...story,
      offering: {
        ...story.offering,
        university: {
          ...story.offering.university,
          country: { slug: 'japan', status: 'DRAFT', deletedAt: null },
        },
      },
    });
    const detail = (await svc.detail(
      'success-stories',
      story.slug,
    )) as unknown as {
      offering: { university: Row };
    };
    expect(detail.offering.university.country).toBeNull();
  });

  it('asks for what decides whether each relation is live', async () => {
    const { svc, calls } = service();
    await svc.list('success-stories', {});
    expect(calls[0]).toMatchObject({
      include: {
        country: { select: { status: true, deletedAt: true } },
        university: {
          select: { status: true, publishStartsAt: true, publishEndsAt: true },
        },
        offering: {
          select: {
            status: true,
            university: {
              select: { country: { select: { slug: true, status: true } } },
            },
          },
        },
      },
    });
  });
});

import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

const story = {
  id: 'story-1',
  title: 'From lecture halls to campaigns',
  slug: 'amara-journey',
  journey: 'A fictional demonstration journey.',
  attribution: 'Amara',
  attributionNote: 'Demonstration profile, not a real student',
  featuredMediaId: 'media-1',
  country: { id: 'country-1', name: 'United Kingdom', slug: 'united-kingdom' },
  university: { id: 'university-1', name: 'Westbridge', slug: 'westbridge' },
  offering: {
    id: 'offering-1',
    name: 'MSc Digital Marketing',
    slug: 'msc-digital-marketing',
    university: { id: 'university-1', name: 'Westbridge', slug: 'westbridge' },
    genericCourse: {
      id: 'course-1',
      name: 'Digital Marketing',
      slug: 'digital-marketing',
    },
  },
};

function service(found = story) {
  const prisma = {
    successStory: {
      findMany: async () => [found],
      count: async () => 1,
      findFirst: async () => found,
    },
    mediaAsset: {
      findMany: async () => [
        {
          id: 'media-1',
          publicUrl: '/media/amara.jpg',
          altText: 'Fictional demonstration portrait',
          title: 'Amara portrait',
        },
      ],
    },
    seoMetadata: { findUnique: async () => null },
  } as unknown as PrismaService;
  return new ExpandedService(prisma, {} as ExperimentsService);
}

describe('ExpandedService public success stories', () => {
  it('returns featured media and stored relationships for the listing and detail', async () => {
    const svc = service();
    const listing = await svc.list('success-stories', {});
    expect(listing.data[0]).toMatchObject({
      title: story.title,
      featuredMedia: { publicUrl: '/media/amara.jpg' },
      country: story.country,
      university: story.university,
      offering: { slug: story.offering.slug },
    });

    await expect(
      svc.detail('success-stories', story.slug),
    ).resolves.toMatchObject({
      journey: story.journey,
      featuredMedia: { altText: 'Fictional demonstration portrait' },
    });
  });

  it('does not resolve an unpublished or missing story', async () => {
    await expect(
      service(null).detail('success-stories', 'missing'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});

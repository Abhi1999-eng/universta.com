import { ExpandedService } from './expanded.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ExperimentsService } from '../experiments/experiments.service';

describe('ExpandedService admin detail media serialization', () => {
  it('keeps a University detail JSON-serializable when SEO media is attached', async () => {
    const prisma = {
      university: {
        findFirst: async () => ({
          id: 'university-1',
          countryId: 'country-1',
          name: 'Test University',
          slug: 'test-university',
          campuses: [],
          accreditations: [],
        }),
      },
      seoMetadata: {
        findUnique: async () => ({
          id: 'seo-1',
          ownerType: 'universities',
          ownerId: 'university-1',
          seoTitle: 'Test University',
          metaDescription: 'Test description',
          ogMedia: { id: 'media-1', fileSizeBytes: 2048n },
          twitterMedia: { id: 'media-2', fileSizeBytes: 4096n },
        }),
      },
    } as unknown as PrismaService;
    const service = new ExpandedService(prisma, {} as ExperimentsService);

    const result = (await service.adminDetail(
      'universities',
      'university-1',
    )) as any;

    expect(result.seo.ogMedia.fileSizeBytes).toBe(2048);
    expect(result.seo.twitterMedia.fileSizeBytes).toBe(4096);
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

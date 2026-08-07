import type { PrismaService } from '../prisma/prisma.service';
import { SubjectsService } from './subjects.service';

type MediaValidator = {
  validateMedia(ids: Array<string | undefined>): Promise<void>;
};

describe('SubjectsService media validation', () => {
  it('allows one active image to be reused across multiple subject media fields', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const service = new SubjectsService({
      mediaAsset: { count },
    } as unknown as PrismaService);
    const validateMedia = (
      service as unknown as MediaValidator
    ).validateMedia.bind(service);

    await expect(
      validateMedia(['media-1', 'media-1', 'media-1']),
    ).resolves.toBeUndefined();

    expect(count).toHaveBeenCalledWith({
      where: {
        id: { in: ['media-1'] },
        status: 'ACTIVE',
        mediaType: 'IMAGE',
        deletedAt: null,
      },
    });
  });

  it('still validates every distinct selected image', async () => {
    const count = jest.fn().mockResolvedValue(2);
    const service = new SubjectsService({
      mediaAsset: { count },
    } as unknown as PrismaService);
    const validateMedia = (
      service as unknown as MediaValidator
    ).validateMedia.bind(service);

    await expect(
      validateMedia(['media-1', 'media-1', 'media-2']),
    ).resolves.toBeUndefined();

    expect(count).toHaveBeenCalledWith({
      where: {
        id: { in: ['media-1', 'media-2'] },
        status: 'ACTIVE',
        mediaType: 'IMAGE',
        deletedAt: null,
      },
    });
  });
});

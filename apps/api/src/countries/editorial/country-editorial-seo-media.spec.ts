import { CountryEditorialService } from './country-editorial.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CountriesService } from '../countries.service';
import type { CountryProfilesService } from '../profiles/country-profiles.service';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import type { SeoMetadataDto } from './editorial.dto';

/** ISS-028. `mediaIds()` already treats '' as "nothing selected" for
 * validation, but the upsert wrote `dto.ogMediaId` / `dto.twitterMediaId`
 * straight through into a MediaAsset foreign key column -- an empty string
 * there is a reference to a row that doesn't exist, which MySQL rejects.
 * Every save of a Country's SEO metadata without an Open Graph or Twitter
 * image crashed with an unhandled 500 (reproduced live via the actual admin
 * UI, which always submits '' for an unselected media picker, never
 * undefined). */

function fakeRequest(): AuthenticatedRequest {
  return {
    user: { sub: 'user-1' },
    ip: '127.0.0.1',
    get: () => 'jest',
    requestId: 'req-1',
  } as unknown as AuthenticatedRequest;
}

function fakePrisma() {
  let capturedUpsertData: {
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  } | null = null;
  const prisma = {
    country: {
      findFirst: async () => ({ id: 'country-1' }),
    },
    seoMetadata: {
      findUnique: async () => null,
      upsert: async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        capturedUpsertData = { create, update };
        return {
          id: 'seo-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          ogMedia: null,
          twitterMedia: null,
          ...create,
        };
      },
    },
    mediaAsset: {
      // Assumes every id the caller selects is a valid, active image --
      // this suite is about what saveSeo() writes, not mediaIds()'s own
      // validation, which is covered by its own behaviour elsewhere.
      count: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.length,
    },
    auditLog: {
      create: async () => ({}),
    },
  } as unknown as PrismaService;
  return { prisma, getCapturedUpsertData: () => capturedUpsertData };
}

function service() {
  const { prisma, getCapturedUpsertData } = fakePrisma();
  const svc = new CountryEditorialService(
    prisma,
    {} as CountriesService,
    {} as CountryProfilesService,
  );
  return { svc, getCapturedUpsertData };
}

describe('CountryEditorialService.saveSeo — empty-string media pickers', () => {
  const baseDto = {
    seoTitle: 'Study in Canada',
    metaDescription: 'Everything you need to know.',
  } as SeoMetadataDto;

  it('writes null, not an empty string, when ogMediaId/twitterMediaId are unset', async () => {
    const { svc, getCapturedUpsertData } = service();
    await svc.saveSeo(
      'country-1',
      { ...baseDto, ogMediaId: '', twitterMediaId: '' },
      fakeRequest(),
    );
    const data = getCapturedUpsertData();
    expect(data?.create.ogMediaId).toBeNull();
    expect(data?.create.twitterMediaId).toBeNull();
    expect(data?.update.ogMediaId).toBeNull();
    expect(data?.update.twitterMediaId).toBeNull();
  });

  it('still writes a real media id straight through', async () => {
    const { svc, getCapturedUpsertData } = service();
    await svc.saveSeo(
      'country-1',
      { ...baseDto, ogMediaId: 'media-1', twitterMediaId: undefined },
      fakeRequest(),
    );
    const data = getCapturedUpsertData();
    expect(data?.create.ogMediaId).toBe('media-1');
    expect(data?.create.twitterMediaId).toBeNull();
  });

  it('clears a prior canonical override when the DTO carries an explicit blank', async () => {
    const { svc, getCapturedUpsertData } = service();
    await svc.saveSeo(
      'country-1',
      { ...baseDto, canonicalUrl: null },
      fakeRequest(),
    );
    const data = getCapturedUpsertData();
    expect(data?.create.canonicalUrl).toBeNull();
    expect(data?.update.canonicalUrl).toBeNull();
  });
});

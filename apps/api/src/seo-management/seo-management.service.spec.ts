import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { SettingsService } from '../settings/settings.service';
import { SeoManagementService } from './seo-management.service';

function createService(options?: {
  template?: Record<string, unknown> | null;
  defaults?: Record<string, unknown>;
}) {
  const siteSettingUpsert = jest.fn();
  const prisma = {
    seoBulkTemplate: {
      findUnique: jest.fn().mockResolvedValue(options?.template ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }) => Promise.resolve(create)),
    },
    mediaAsset: { findFirst: jest.fn().mockResolvedValue(null) },
    siteSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: siteSettingUpsert,
    },
  } as unknown as PrismaService;
  const settings = {
    publicGetAll: jest.fn().mockResolvedValue({
      seo: {
        defaultTitleSuffix: '| Universta',
        defaultDescription: 'Global default description.',
        defaultRobotsIndex: true,
        defaultRobotsFollow: true,
        ...(options?.defaults ?? {}),
      },
    }),
  } as unknown as SettingsService;
  return {
    service: new SeoManagementService(prisma, settings),
    prisma,
    siteSettingUpsert,
  };
}

describe('SeoManagementService resolver', () => {
  const university = {
    id: 'university-1',
    name: 'Demo University',
    slug: 'demo-university',
    country: { name: 'Canada', slug: 'canada' },
    campuses: [{ city: 'Toronto' }],
    shortDescription: 'A fictional university.',
  };

  it('uses manual metadata before the reusable bulk rule', async () => {
    const { service } = createService({
      template: {
        entityType: 'university',
        seoTitleTemplate: '{universityName} in {countryName}',
        metaDescriptionTemplate: 'Bulk {universityName}',
      },
    });
    const result = await service.resolve('university', university, {
      seoTitle: 'Manual University Title',
      metaDescription: 'Manual description.',
      robotsIndex: false,
      robotsFollow: false,
    });
    expect(result).toMatchObject({
      seoTitle: 'Manual University Title',
      metaDescription: 'Manual description.',
      robotsIndex: false,
      robotsFollow: false,
      source: { title: 'manual', description: 'manual' },
    });
  });

  it('uses a bulk rule before global defaults and updates dynamically', async () => {
    const { service, prisma } = createService({
      template: {
        entityType: 'university',
        seoTitleTemplate: '{universityName} in {countryName}',
        metaDescriptionTemplate: 'Apply to {universityName}.',
      },
    });
    await expect(
      service.resolve('university', university, null),
    ).resolves.toMatchObject({
      seoTitle: 'Demo University in Canada',
      metaDescription: 'Apply to Demo University.',
      source: { title: 'bulk', description: 'bulk' },
    });
    prisma.seoBulkTemplate.findUnique.mockResolvedValueOnce({
      entityType: 'university',
      seoTitleTemplate: 'Study at {universityName}',
      metaDescriptionTemplate: 'Updated template.',
    });
    await expect(
      service.resolve('university', university, null),
    ).resolves.toMatchObject({
      seoTitle: 'Study at Demo University',
      metaDescription: 'Updated template.',
    });
  });

  it('uses default SEO and then a safe record fallback when no rule exists', async () => {
    const withDefault = createService();
    await expect(
      withDefault.service.resolve('university', university, null),
    ).resolves.toMatchObject({
      seoTitle: 'Demo University',
      metaDescription: 'Global default description.',
      source: { title: 'fallback', description: 'default' },
    });
    const withoutDefault = createService({
      defaults: { defaultDescription: '' },
    });
    await expect(
      withoutDefault.service.resolve('university', university, null),
    ).resolves.toMatchObject({
      seoTitle: 'Demo University',
      metaDescription: 'A fictional university.',
      source: { description: 'fallback' },
    });
  });

  it('renders missing values safely without unresolved tokens or dangling punctuation', async () => {
    const { service } = createService({
      template: {
        entityType: 'university',
        seoTitleTemplate: '{universityName} in {cityName}, {countryName}',
        metaDescriptionTemplate: 'Courses at {universityName}.',
      },
    });
    const result = await service.resolve(
      'university',
      { ...university, campuses: [] },
      null,
    );
    expect(result.seoTitle).toBe('Demo University, Canada');
    expect(result.seoTitle).not.toContain('{cityName}');
  });

  it('rejects unknown or malformed variables before a template is stored', async () => {
    const { service } = createService();
    await expect(
      service.saveTemplate('university', {
        seoTitleTemplate: '{unknownVariable}',
      }),
    ).rejects.toMatchObject<Partial<BadRequestException>>({
      response: expect.objectContaining({ code: 'INVALID_SEO_TEMPLATE' }),
    });
    await expect(
      service.saveTemplate('university', {
        seoTitleTemplate: '{universityName',
      }),
    ).rejects.toMatchObject<Partial<BadRequestException>>({
      response: expect.objectContaining({ code: 'INVALID_SEO_TEMPLATE' }),
    });
  });

  it('persists only a sanitized Google verification token', async () => {
    const { service, siteSettingUpsert } = createService();
    await expect(
      service.saveSiteVerification({ google: '<meta>' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_SITE_VERIFICATION_TOKEN',
      }),
    });
    await service.saveSiteVerification(
      { google: 'google_token-123' },
      'admin-1',
    );
    expect(siteSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          valueJson: { google: 'google_token-123' },
          isPublic: true,
        }),
      }),
    );
  });
});

import { StatsPillsService } from './stats-pills.service';
import { STATS_PILL_DEFAULTS, statsPillEnvelope } from './stats-pill.contract';

function build() {
  const prisma = {
    page: { findFirst: jest.fn() },
    pageSection: {
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    country: { count: jest.fn().mockResolvedValue(13) },
    university: { count: jest.fn().mockResolvedValue(942) },
    subject: { count: jest.fn().mockResolvedValue(8) },
    course: { count: jest.fn().mockResolvedValue(25) },
    scholarship: { count: jest.fn().mockResolvedValue(4) },
    consultant: { count: jest.fn().mockResolvedValue(3) },
    countryCourse: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ countryId: 'ca' }, { countryId: 'gb' }]),
    },
  };
  return { prisma, service: new StatsPillsService(prisma as never) };
}

describe('StatsPillsService', () => {
  it('uses the canonical public country predicate', async () => {
    const { prisma, service } = build();
    await expect(service.count('PUBLISHED_COUNTRIES')).resolves.toBe(13);
    expect(prisma.country.count).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        continent: { status: 'ACTIVE', deletedAt: null },
      },
    });
  });

  it('applies publication windows to scheduled automatic sources', async () => {
    const { prisma, service } = build();
    for (const source of [
      'PUBLISHED_UNIVERSITIES',
      'PUBLISHED_COURSES',
      'PUBLISHED_SCHOLARSHIPS',
      'PUBLISHED_CONSULTANTS',
    ] as const) {
      await service.count(source);
    }
    for (const model of [
      prisma.university,
      prisma.course,
      prisma.scholarship,
      prisma.consultant,
    ]) {
      expect(model.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          deletedAt: null,
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      });
    }
  });

  it('counts course destinations as distinct public countries with public programs', async () => {
    const { prisma, service } = build();
    await expect(service.count('COURSE_DESTINATIONS')).resolves.toBe(2);
    expect(prisma.countryCourse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['countryId'],
        where: expect.objectContaining({
          status: 'ACTIVE',
          deletedAt: null,
          country: expect.objectContaining({
            status: 'PUBLISHED',
            deletedAt: null,
          }),
          course: expect.objectContaining({
            status: 'PUBLISHED',
            deletedAt: null,
          }),
        }),
      }),
    );
  });

  it('keeps draft values out of the canonical public response', async () => {
    const { prisma, service } = build();
    const published = structuredClone(STATS_PILL_DEFAULTS.home);
    const draft = structuredClone(published);
    published.items[0] = {
      ...published.items[0],
      sourceMode: 'MANUAL',
      manualValue: 13,
      label: 'destinations',
    };
    draft.items[0] = {
      ...draft.items[0],
      sourceMode: 'MANUAL',
      manualValue: 99,
      label: 'draft places',
    };
    prisma.pageSection.findFirst.mockResolvedValue({
      bodyJson: { schemaVersion: 1, draft, published },
    });
    const publicPill = await service.publicForPage('home');
    const previewPill = await service.previewForPage('home');
    expect(prisma.pageSection.findFirst.mock.calls[0][0].where.page).toEqual(
      expect.objectContaining({
        slug: 'home',
        status: { in: ['PUBLISHED', 'SCHEDULED'] },
        deletedAt: null,
      }),
    );
    expect(publicPill?.items[0]).toMatchObject({
      value: 13,
      label: 'destinations',
    });
    expect(previewPill?.items[0]).toMatchObject({
      value: 99,
      label: 'draft places',
    });
  });

  it('saves draft without changing published and publishes only explicitly', async () => {
    const { prisma, service } = build();
    const envelope = statsPillEnvelope(STATS_PILL_DEFAULTS.home);
    prisma.page.findFirst.mockResolvedValue({
      id: 'page-1',
      slug: 'home',
      title: 'Home',
      sections: [{ id: 'section-1', bodyJson: envelope }],
    });
    const draft = structuredClone(STATS_PILL_DEFAULTS.home);
    draft.items[0] = {
      ...draft.items[0],
      sourceMode: 'MANUAL',
      manualValue: 42,
    };
    await service.saveDraft('page-1', draft, 'admin-1');
    const draftWrite = prisma.pageSection.update.mock.calls[0][0].data.bodyJson;
    expect(draftWrite.draft.items[0].manualValue).toBe(42);
    expect(draftWrite.published.items[0].sourceMode).toBe('AUTOMATIC');

    prisma.page.findFirst.mockResolvedValue({
      id: 'page-1',
      slug: 'home',
      title: 'Home',
      sections: [{ id: 'section-1', bodyJson: draftWrite }],
    });
    await service.publish('page-1', 'admin-1');
    const publishedWrite =
      prisma.pageSection.update.mock.calls[1][0].data.bodyJson;
    expect(publishedWrite.published.items[0].manualValue).toBe(42);
    expect(prisma.pageSection.update.mock.calls[1][0].data.status).toBe(
      'ACTIVE',
    );
  });

  it('publishes a hidden block as a non-public PageSection', async () => {
    const { prisma, service } = build();
    const envelope = statsPillEnvelope(STATS_PILL_DEFAULTS.home);
    envelope.draft.visible = false;
    prisma.page.findFirst.mockResolvedValue({
      id: 'page-1',
      slug: 'home',
      title: 'Home',
      sections: [{ id: 'section-1', bodyJson: envelope }],
    });
    await service.publish('page-1', 'admin-1');
    expect(prisma.pageSection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ARCHIVED' }),
      }),
    );
  });
});

import { CountryDerivedService } from './country-derived.service';

describe('CountryDerivedService', () => {
  it('derives compatible tuition, counts, and the top ten ranked universities', async () => {
    const prisma = {
      university: {
        count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(5),
        findMany: jest.fn().mockResolvedValue(
          Array.from({ length: 10 }, (_, index) => ({
            id: `u-${index + 1}`,
            name: `University ${index + 1}`,
            slug: `university-${index + 1}`,
            institutionType: 'PUBLIC',
            qsRanking: index + 1,
          })),
        ),
      },
      universityCourseOffering: {
        count: jest.fn().mockResolvedValue(24),
        findMany: jest.fn().mockResolvedValue([
          { tuitionMin: { toString: () => '10000' }, tuitionMax: null },
          { tuitionMin: null, tuitionMax: { toString: () => '12000' } },
          { tuitionMin: null, tuitionMax: null },
        ]),
      },
      countryPopularUniversity: { findMany: jest.fn().mockResolvedValue([]) },
      countryPopularCourse: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    // The focused aggregate test only supplies the Prisma delegates it calls.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const service = new CountryDerivedService(prisma);

    const result = await service.detail({
      id: 'country-1',
      currencyCode: 'CAD',
      currencySymbol: '$',
    });

    expect(result.statistics).toEqual({
      universitiesCount: 12,
      publicUniversitiesCount: 5,
      coursesCount: 24,
    });
    expect(result.averageTuition).toMatchObject({
      amount: '11000',
      currencyCode: 'CAD',
      offeringCount: 2,
    });
    expect(result.topRankedUniversities).toHaveLength(10);
    expect(result.topRankedUniversities[0]).toMatchObject({
      id: 'u-1',
      qsRanking: 1,
    });
    expect(prisma.university.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('returns no average where there is no compatible usable tuition', async () => {
    const prisma = {
      university: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      universityCourseOffering: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      countryPopularUniversity: { findMany: jest.fn().mockResolvedValue([]) },
      countryPopularCourse: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const service = new CountryDerivedService(prisma);

    await expect(
      service.detail({
        id: 'country-1',
        currencyCode: 'CAD',
        currencySymbol: '$',
      }),
    ).resolves.toMatchObject({ averageTuition: null });
  });

  it('ignores null and invalid tuition values and only queries valid local rankings', async () => {
    const prisma = {
      university: {
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      universityCourseOffering: {
        count: jest.fn().mockResolvedValue(4),
        findMany: jest.fn().mockResolvedValue([
          { tuitionMin: { toString: () => '9000' }, tuitionMax: null },
          { tuitionMin: null, tuitionMax: { toString: () => '12000' } },
          { tuitionMin: null, tuitionMax: null },
          { tuitionMin: { toString: () => 'not-a-number' }, tuitionMax: null },
        ]),
      },
      countryPopularUniversity: { findMany: jest.fn().mockResolvedValue([]) },
      countryPopularCourse: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new CountryDerivedService(prisma);

    const result = await service.detail({
      id: 'country-1',
      currencyCode: 'CAD',
      currencySymbol: '$',
    });

    expect(result.averageTuition).toMatchObject({
      amount: '10500',
      offeringCount: 2,
    });
    expect(prisma.university.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ qsRanking: { gt: 0 } }),
        orderBy: [{ qsRanking: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
    );
    expect(prisma.universityCourseOffering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          currencyCode: 'CAD',
          university: expect.objectContaining({ countryId: 'country-1' }),
        }),
      }),
    );
  });

  it('rejects duplicate and cross-country curated relationships before writing', async () => {
    const prisma = {
      university: { findMany: jest.fn().mockResolvedValue([]) },
      course: { findMany: jest.fn().mockResolvedValue([]) },
      countryPopularUniversity: { deleteMany: jest.fn(), create: jest.fn() },
      countryPopularCourse: { deleteMany: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    const service = new CountryDerivedService(prisma);

    await expect(
      service.validateCuratedRelationships('country-1', [
        'university-1',
        'university-1',
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'COUNTRY_CURATED_RELATION_INVALID',
      }),
    });
    await expect(
      service.validateCuratedRelationships('country-1', ['university-2']),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'COUNTRY_CURATED_RELATION_INVALID',
      }),
    });
    await expect(
      service.validateCuratedRelationships('country-1', undefined, [
        'course-2',
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'COUNTRY_CURATED_RELATION_INVALID',
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

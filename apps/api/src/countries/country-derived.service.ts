import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CountryIdentity = {
  id: string;
  currencyCode: string | null;
  currencySymbol: string | null;
};

const publishedUniversityWhere = (countryId: string) => ({
  countryId,
  status: 'PUBLISHED',
  deletedAt: null,
});

const publishedOfferingWhere = (countryId: string) => ({
  status: 'PUBLISHED',
  deletedAt: null,
  university: publishedUniversityWhere(countryId),
});

function invalid(message: string) {
  return new BadRequestException({
    code: 'COUNTRY_CURATED_RELATION_INVALID',
    message,
    details: null,
  });
}

@Injectable()
export class CountryDerivedService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(country: CountryIdentity) {
    const universityWhere = publishedUniversityWhere(country.id);
    const offeringWhere = publishedOfferingWhere(country.id);
    const [
      universitiesCount,
      publicUniversitiesCount,
      coursesCount,
      tuitionRows,
      topRankedUniversities,
      popularUniversities,
      popularCourses,
    ] = await Promise.all([
      this.prisma.university.count({ where: universityWhere }),
      this.prisma.university.count({
        where: {
          ...universityWhere,
          institutionType: { in: ['PUBLIC', 'Public', 'public'] },
        },
      }),
      this.prisma.universityCourseOffering.count({ where: offeringWhere }),
      country.currencyCode
        ? this.prisma.universityCourseOffering.findMany({
            where: { ...offeringWhere, currencyCode: country.currencyCode },
            select: { tuitionMin: true, tuitionMax: true },
          })
        : Promise.resolve([]),
      this.prisma.university.findMany({
        where: { ...universityWhere, qsRanking: { gt: 0 } },
        select: {
          id: true,
          name: true,
          slug: true,
          institutionType: true,
          qsRanking: true,
        },
        orderBy: [{ qsRanking: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
      this.prisma.countryPopularUniversity.findMany({
        where: {
          countryId: country.id,
          university: universityWhere,
        },
        select: {
          displayOrder: true,
          university: {
            select: {
              id: true,
              name: true,
              slug: true,
              institutionType: true,
              qsRanking: true,
            },
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { universityId: 'asc' }],
      }),
      this.prisma.countryPopularCourse.findMany({
        where: {
          countryId: country.id,
          course: { status: 'PUBLISHED', deletedAt: null },
        },
        select: {
          displayOrder: true,
          course: {
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
            },
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { courseId: 'asc' }],
      }),
    ]);

    // A UniversityCourseOffering is the canonical price observation. Multiple
    // offerings for one generic course stay distinct because campus, level,
    // mode, and intake can legitimately have different tuition.
    const tuitionValues = tuitionRows
      .map((row) => row.tuitionMin ?? row.tuitionMax)
      .filter((value) => value !== null && value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const average = tuitionValues.length
      ? tuitionValues.reduce((sum, value) => sum + value, 0) /
        tuitionValues.length
      : null;

    return {
      averageTuition:
        average === null || !country.currencyCode
          ? null
          : {
              amount: Number(average.toFixed(2)).toString(),
              currencyCode: country.currencyCode,
              currencySymbol: country.currencySymbol,
              period: 'PER_YEAR',
              offeringCount: tuitionValues.length,
            },
      statistics: {
        universitiesCount,
        publicUniversitiesCount,
        coursesCount,
      },
      topRankedUniversities,
      popularUniversities: popularUniversities.map((row) => row.university),
      popularCourses: popularCourses.map((row) => row.course),
    };
  }

  async curationOptions(countryId: string) {
    const [universities, courses] = await Promise.all([
      this.prisma.university.findMany({
        where: publishedUniversityWhere(countryId),
        select: { id: true, name: true, slug: true, qsRanking: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.course.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          OR: [
            {
              countryCourses: {
                some: { countryId, status: 'ACTIVE', deletedAt: null },
              },
            },
            {
              universityOfferings: {
                some: { ...publishedOfferingWhere(countryId) },
              },
            },
          ],
        },
        select: { id: true, name: true, slug: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return { universities, courses };
  }

  async replaceCuratedRelationships(
    countryId: string,
    universityIds?: string[],
    courseIds?: string[],
  ) {
    await this.validateCuratedRelationships(
      countryId,
      universityIds,
      courseIds,
    );
    if (universityIds !== undefined) {
      const uniqueIds = [...new Set(universityIds)];
      await this.prisma.$transaction([
        this.prisma.countryPopularUniversity.deleteMany({
          where: { countryId },
        }),
        ...uniqueIds.map((universityId, displayOrder) =>
          this.prisma.countryPopularUniversity.create({
            data: { countryId, universityId, displayOrder },
          }),
        ),
      ]);
    }

    if (courseIds !== undefined) {
      const uniqueIds = [...new Set(courseIds)];
      await this.prisma.$transaction([
        this.prisma.countryPopularCourse.deleteMany({ where: { countryId } }),
        ...uniqueIds.map((courseId, displayOrder) =>
          this.prisma.countryPopularCourse.create({
            data: { countryId, courseId, displayOrder },
          }),
        ),
      ]);
    }
  }

  async validateCuratedRelationships(
    countryId: string,
    universityIds?: string[],
    courseIds?: string[],
  ) {
    if (universityIds !== undefined) {
      const uniqueIds = [...new Set(universityIds)];
      if (uniqueIds.length !== universityIds.length)
        throw invalid('Popular Universities cannot contain duplicate records');
      const found = await this.prisma.university.findMany({
        where: {
          id: { in: uniqueIds },
          ...publishedUniversityWhere(countryId),
        },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length)
        throw invalid(
          'Popular Universities must be published universities in this country',
        );
    }
    if (courseIds !== undefined) {
      const uniqueIds = [...new Set(courseIds)];
      if (uniqueIds.length !== courseIds.length)
        throw invalid('Popular Courses cannot contain duplicate records');
      const options = await this.curationOptions(countryId);
      const validIds = new Set(options.courses.map((course) => course.id));
      if (!uniqueIds.every((id) => validIds.has(id)))
        throw invalid(
          'Popular Courses must be published courses available in this country',
        );
    }
  }
}

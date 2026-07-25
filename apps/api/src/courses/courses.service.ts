import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  catalogBadRequest,
  catalogConflict,
  catalogNotFound,
  catalogNotReady,
} from '../catalog/catalog.errors';
import {
  COURSE_SECTION_KEYS,
  COURSE_SECTION_TYPES,
  isUniqueConstraintError,
  paginationMeta,
  slugify,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type {
  CreateContentSectionDto,
  CreateCountryCourseDto,
  CreateCourseDto,
  CreateFaqDto,
  CourseActionDto,
  CourseListQueryDto,
  IntakeReplacementDto,
  RelatedCourseReplacementDto,
  StudyModeReplacementDto,
  UpdateContentSectionDto,
  UpdateCountryCourseDto,
  UpdateCourseDto,
  UpdateFaqDto,
} from './dto/course.dto';
import type { SeoMetadataDto } from '../subjects/dto/subject.dto';

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  altText: true,
  title: true,
  width: true,
  height: true,
  status: true,
  deletedAt: true,
} as const;
const COURSE_PUBLIC_INCLUDE = {
  subject: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
  subSubject: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
  courseLevel: { select: { id: true, name: true, code: true, status: true } },
  featuredMedia: { select: MEDIA_SELECT },
  studyModes: {
    include: {
      studyMode: { select: { id: true, name: true, code: true, status: true } },
    },
  },
} satisfies Prisma.CourseInclude;
const COURSE_ADMIN_INCLUDE = {
  ...COURSE_PUBLIC_INCLUDE,
  countryCourses: {
    include: {
      country: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
      intakes: { include: { intake: true } },
    },
  },
  contentSections: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  faqs: {
    where: { deletedAt: null },
    orderBy: [{ displayOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  relatedFrom: {
    include: {
      relatedCourse: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.CourseInclude;

type MediaRecord = {
  id: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  status: string;
  deletedAt: Date | null;
} | null;
type PublicCourse = Prisma.CourseGetPayload<{
  include: typeof COURSE_PUBLIC_INCLUDE;
}>;
type AdminCourse = Prisma.CourseGetPayload<{
  include: typeof COURSE_ADMIN_INCLUDE;
}>;

function actor(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}
function media(row: MediaRecord) {
  return row && row.status === 'ACTIVE' && !row.deletedAt
    ? {
        id: row.id,
        url: row.publicUrl,
        alt: row.altText ?? row.title ?? '',
        title: row.title,
        width: row.width,
        height: row.height,
      }
    : null;
}
function decimal(
  value: string | Prisma.Decimal | null | undefined,
): string | null {
  return value === null || value === undefined ? null : value.toString();
}
function date(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}
function version(current: Date, expected: string | undefined, code: string) {
  if (expected && current.getTime() !== new Date(expected).getTime())
    throw catalogConflict(
      code,
      'The record changed in another session. Reload before saving',
    );
}
function isHttps(value: string | undefined | null): boolean {
  return !value || /^https:\/\//i.test(value);
}
function rangeError(
  min: string | undefined,
  max: string | undefined,
  code: string,
  label: string,
) {
  if (min !== undefined && max !== undefined && Number(min) > Number(max))
    throw catalogBadRequest(code, `${label} minimum cannot exceed maximum`);
}
function toDecimal(value: string | undefined): Prisma.Decimal | undefined {
  return value === undefined ? undefined : new Prisma.Decimal(value);
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async publicList(query: CourseListQueryDto) {
    if ((query.minTuition || query.maxTuition) && !query.country)
      throw catalogBadRequest(
        'COURSE_TUITION_COUNTRY_REQUIRED',
        'Tuition filters require a country',
      );
    const where = this.publicWhere(query);
    const include = this.publicInclude(query.country);
    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include,
        orderBy: this.publicOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) =>
        this.toPublicList(row as PublicCourse, query.country),
      ),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async suggestions(q: string) {
    const rows = await this.prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        OR: [
          { name: { contains: q.trim() } },
          { slug: { contains: q.trim().toLowerCase() } },
          { shortName: { contains: q.trim() } },
        ],
      },
      include: COURSE_PUBLIC_INCLUDE,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 10,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      subject: row.subject,
      courseLevel: row.courseLevel,
    }));
  }

  async publicDetail(slug: string, countrySlug?: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
        subject: { status: 'PUBLISHED', deletedAt: null },
        courseLevel: { status: 'ACTIVE' },
      },
      include: {
        ...COURSE_PUBLIC_INCLUDE,
        countryCourses: {
          where: this.publicMappingWhere(countrySlug),
          include: {
            country: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                deletedAt: true,
              },
            },
            intakes: {
              where: { status: 'ACTIVE', intake: { status: 'ACTIVE' } },
              include: {
                intake: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    shortLabel: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
        contentSections: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
        faqs: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
        relatedFrom: {
          where: { relatedCourse: { status: 'PUBLISHED', deletedAt: null } },
          include: { relatedCourse: { include: COURSE_PUBLIC_INCLUDE } },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!course) throw catalogNotFound('COURSE_NOT_FOUND', 'Course not found');
    if (countrySlug && !course.countryCourses.length)
      throw catalogNotFound(
        'COURSE_COUNTRY_NOT_FOUND',
        'Course is not available for that country',
      );
    const seo = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'COURSE', ownerId: course.id } },
      include: {
        ogMedia: { select: MEDIA_SELECT },
        twitterMedia: { select: MEDIA_SELECT },
      },
    });
    const payload = this.toPublicList(course, countrySlug);
    return {
      ...payload,
      overview: course.overview,
      careerSummary: course.careerSummary,
      availability: course.countryCourses.map((mapping: any) =>
        this.toPublicMapping(mapping),
      ),
      selectedCountry: countrySlug
        ? (course.countryCourses[0]?.country ?? null)
        : null,
      contentSections: course.contentSections.map((section: any) =>
        this.toPublicSection(section),
      ),
      faqs: course.faqs,
      relatedCourses: course.relatedFrom.map((relation: any) =>
        this.toPublicList(relation.relatedCourse as PublicCourse),
      ),
      seo: this.toSeo(seo),
      jsonLd: this.courseJsonLd(course as any, seo),
    };
  }

  async adminList(query: CourseListQueryDto) {
    const where = this.adminWhere(query);
    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: COURSE_ADMIN_INCLUDE,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => this.toAdmin(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }
  async getAdmin(id: string) {
    return this.toAdmin(await this.adminCourse(id));
  }

  async create(dto: CreateCourseDto, request: AuthenticatedRequest) {
    const userId = actor(request);
    await this.validateCoreReferences(
      dto.subjectId,
      dto.subSubjectId,
      dto.courseLevelId,
      dto.featuredMediaId,
    );
    this.validateDuration(dto.durationMin, dto.durationMax);
    this.validatePopularity(dto.popularityScore);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    try {
      const row = await this.prisma.course.create({
        data: {
          subjectId: dto.subjectId,
          subSubjectId: dto.subSubjectId,
          courseLevelId: dto.courseLevelId,
          name,
          shortName: dto.shortName?.trim(),
          qualificationName: dto.qualificationName?.trim(),
          slug,
          courseCode: dto.courseCode?.trim(),
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          durationMin: toDecimal(dto.durationMin),
          durationMax: toDecimal(dto.durationMax),
          durationUnit: dto.durationUnit,
          credits: toDecimal(dto.credits),
          featuredMediaId: dto.featuredMediaId,
          careerSummary: dto.careerSummary?.trim(),
          popularityScore:
            toDecimal(dto.popularityScore) ?? new Prisma.Decimal('0'),
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: COURSE_ADMIN_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE',
        row.id,
        'CREATE',
        null,
        { name, slug, status: row.status },
        'Course created',
      );
      return this.toAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict('COURSE_CONFLICT', 'Course slug already exists');
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    await this.validateCoreReferences(
      dto.subjectId,
      dto.subSubjectId,
      dto.courseLevelId,
      dto.featuredMediaId,
    );
    this.validateDuration(dto.durationMin, dto.durationMax);
    this.validatePopularity(dto.popularityScore);
    try {
      const row = await this.prisma.course.update({
        where: { id },
        data: {
          subjectId: dto.subjectId,
          subSubjectId: dto.subSubjectId,
          courseLevelId: dto.courseLevelId,
          name: dto.name.trim(),
          shortName: dto.shortName?.trim(),
          qualificationName: dto.qualificationName?.trim(),
          slug: dto.slug?.trim() || current.slug,
          courseCode: dto.courseCode?.trim(),
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          durationMin: toDecimal(dto.durationMin),
          durationMax: toDecimal(dto.durationMax),
          durationUnit: dto.durationUnit,
          credits: toDecimal(dto.credits),
          featuredMediaId: dto.featuredMediaId,
          careerSummary: dto.careerSummary?.trim(),
          ...(dto.popularityScore !== undefined
            ? { popularityScore: toDecimal(dto.popularityScore) }
            : {}),
          ...(dto.isFeatured !== undefined
            ? { isFeatured: dto.isFeatured }
            : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: userId,
        },
        include: COURSE_ADMIN_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE',
        id,
        'UPDATE',
        { name: current.name, slug: current.slug, status: current.status },
        { name: row.name, slug: row.slug, status: row.status },
        'Course updated',
      );
      return this.toAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict('COURSE_CONFLICT', 'Course slug already exists');
      throw error;
    }
  }

  async publish(
    id: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    const readiness = await this.publishReadiness(current);
    if (readiness.length)
      throw catalogNotReady(
        'COURSE_NOT_READY',
        'Complete course readiness requirements before publishing',
        readiness,
      );
    const row = await this.prisma.course.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: COURSE_ADMIN_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'PUBLISH',
      { status: current.status },
      { status: row.status },
      'Course published',
    );
    return this.toAdmin(row);
  }
  async unpublish(
    id: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    const row = await this.prisma.course.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: COURSE_ADMIN_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'UNPUBLISH',
      { status: current.status },
      { status: row.status },
      'Course unpublished',
    );
    return this.toAdmin(row);
  }
  async remove(
    id: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    const row = await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DRAFT',
        publishedAt: null,
        updatedByUserId: userId,
      },
      include: COURSE_ADMIN_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'DELETE',
      { name: current.name, status: current.status },
      { deleted: true },
      'Course soft-deleted',
    );
    return { deleted: true, id: row.id };
  }

  async replaceStudyModes(
    id: string,
    dto: StudyModeReplacementDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    const modes = await this.prisma.studyMode.findMany({
      where: { id: { in: dto.studyModeIds }, status: 'ACTIVE' },
    });
    if (
      modes.length !== dto.studyModeIds.length ||
      (!dto.studyModeIds.length && current.status === 'PUBLISHED')
    )
      throw catalogConflict(
        'COURSE_STUDY_MODES_INVALID',
        'Published courses need at least one active study mode',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.courseStudyMode.deleteMany({ where: { courseId: id } });
      if (dto.studyModeIds.length)
        await tx.courseStudyMode.createMany({
          data: dto.studyModeIds.map((studyModeId) => ({
            courseId: id,
            studyModeId,
          })),
        });
      await tx.course.update({
        where: { id },
        data: { updatedAt: new Date(), updatedByUserId: userId },
      });
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'STUDY_MODES_REPLACE',
      null,
      { count: dto.studyModeIds.length },
      'Course study modes replaced',
    );
    return this.toAdmin(await this.adminCourse(id));
  }

  async listMappings(id: string) {
    const course = await this.adminCourse(id);
    return course.countryCourses.map((mapping: any) =>
      this.toAdminMapping(mapping),
    );
  }
  async createMapping(
    id: string,
    dto: CreateCountryCourseDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    await this.adminCourse(id);
    await this.validateMapping(dto);
    await this.ensureCountry(dto.countryId);
    try {
      const row = await this.prisma.countryCourse.create({
        data: this.mappingData(id, dto),
        include: {
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
            },
          },
          intakes: { include: { intake: true } },
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE',
        id,
        'COUNTRY_MAPPING_CREATE',
        null,
        {
          countryId: dto.countryId,
          status: row.status,
          availabilityStatus: row.availabilityStatus,
        },
        'Country-course mapping created',
      );
      return this.toAdminMapping(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'COURSE_COUNTRY_DUPLICATE',
          'This country is already mapped to the course',
        );
      throw error;
    }
  }
  async updateMapping(
    id: string,
    mappingId: string,
    dto: UpdateCountryCourseDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.mapping(id, mappingId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_COUNTRY_STALE_VERSION',
    );
    await this.validateMapping(dto);
    await this.ensureCountry(dto.countryId);
    try {
      const row = await this.prisma.countryCourse.update({
        where: { id: mappingId },
        data: this.mappingData(id, dto),
        include: {
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
            },
          },
          intakes: { include: { intake: true } },
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE',
        id,
        'COUNTRY_MAPPING_UPDATE',
        { countryId: current.countryId },
        {
          countryId: row.countryId,
          status: row.status,
          availabilityStatus: row.availabilityStatus,
        },
        'Country-course mapping updated',
      );
      return this.toAdminMapping(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'COURSE_COUNTRY_DUPLICATE',
          'This country is already mapped to the course',
        );
      throw error;
    }
  }
  async removeMapping(
    id: string,
    mappingId: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.mapping(id, mappingId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_COUNTRY_STALE_VERSION',
    );
    await this.prisma.countryCourse.update({
      where: { id: mappingId },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'COUNTRY_MAPPING_DELETE',
      { countryId: current.countryId },
      { deleted: true },
      'Country-course mapping removed',
    );
    return { deleted: true };
  }

  async listIntakes(id: string, mappingId: string) {
    const mapping = await this.mapping(id, mappingId);
    return mapping.intakes.map((row: any) => this.toIntake(row));
  }
  async replaceIntakes(
    id: string,
    mappingId: string,
    dto: IntakeReplacementDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const mapping = await this.mapping(id, mappingId);
    version(
      mapping.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_INTAKES_STALE_VERSION',
    );
    const ids = dto.intakes.map((item) => item.intakeId);
    if (new Set(ids).size !== ids.length)
      throw catalogConflict(
        'COURSE_INTAKES_DUPLICATE',
        'An intake can only be selected once',
      );
    const masters = await this.prisma.intake.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
    });
    if (masters.length !== ids.length)
      throw catalogConflict(
        'COURSE_INTAKE_INVALID',
        'One or more intake options are inactive',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.countryCourseIntake.deleteMany({
        where: { countryCourseId: mappingId },
      });
      if (dto.intakes.length)
        await tx.countryCourseIntake.createMany({
          data: dto.intakes.map((item) => ({
            countryCourseId: mappingId,
            intakeId: item.intakeId,
            applicationDeadline: item.applicationDeadline
              ? new Date(item.applicationDeadline)
              : null,
            deadlineNotes: item.deadlineNotes?.trim(),
            status: item.status ?? 'ACTIVE',
          })),
        });
      await tx.countryCourse.update({
        where: { id: mappingId },
        data: { updatedAt: new Date() },
      });
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'INTAKES_REPLACE',
      null,
      { countryCourseId: mappingId, count: dto.intakes.length },
      'Course-country intakes replaced',
    );
    return this.listIntakes(id, mappingId);
  }

  async listSections(id: string) {
    await this.adminCourse(id);
    return (
      await this.prisma.courseContentSection.findMany({
        where: { courseId: id, deletedAt: null },
        include: { media: { select: MEDIA_SELECT } },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      })
    ).map((row) => this.toAdminSection(row));
  }
  async createSection(
    id: string,
    dto: CreateContentSectionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    await this.adminCourse(id);
    await this.validateSection(dto);
    try {
      const row = await this.prisma.courseContentSection.create({
        data: {
          courseId: id,
          sectionKey: dto.sectionKey,
          heading: dto.heading?.trim(),
          subheading: dto.subheading?.trim(),
          bodyJson: this.sectionBody(dto),
          mediaId: dto.mediaId,
          displayOrder: dto.displayOrder ?? 0,
          status: dto.status ?? 'ACTIVE',
        },
        include: { media: { select: MEDIA_SELECT } },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE',
        id,
        'CONTENT_CREATE',
        null,
        { sectionKey: row.sectionKey, sectionType: dto.sectionType },
        'Course content section created',
      );
      return this.toAdminSection(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'COURSE_SECTION_DUPLICATE',
          'This content section key already exists',
        );
      throw error;
    }
  }
  async updateSection(
    id: string,
    sectionId: string,
    dto: UpdateContentSectionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.section(id, sectionId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_SECTION_STALE_VERSION',
    );
    await this.validateSection(dto);
    const row = await this.prisma.courseContentSection.update({
      where: { id: sectionId },
      data: {
        sectionKey: dto.sectionKey,
        heading: dto.heading?.trim(),
        subheading: dto.subheading?.trim(),
        bodyJson: this.sectionBody(dto),
        mediaId: dto.mediaId,
        displayOrder: dto.displayOrder ?? current.displayOrder,
        status: dto.status ?? current.status,
      },
      include: { media: { select: MEDIA_SELECT } },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'CONTENT_UPDATE',
      { sectionKey: current.sectionKey },
      { sectionKey: row.sectionKey, sectionType: dto.sectionType },
      'Course content section updated',
    );
    return this.toAdminSection(row);
  }
  async removeSection(
    id: string,
    sectionId: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.section(id, sectionId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_SECTION_STALE_VERSION',
    );
    await this.prisma.courseContentSection.update({
      where: { id: sectionId },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'CONTENT_DELETE',
      { sectionKey: current.sectionKey },
      { deleted: true },
      'Course content section deleted',
    );
    return { deleted: true };
  }

  async listFaqs(id: string) {
    await this.adminCourse(id);
    return this.prisma.courseFaq.findMany({
      where: { courseId: id, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
  }
  async createFaq(
    id: string,
    dto: CreateFaqDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    await this.adminCourse(id);
    const row = await this.prisma.courseFaq.create({
      data: {
        courseId: id,
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        status: dto.status ?? 'ACTIVE',
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'FAQ_CREATE',
      null,
      { faqId: row.id },
      'Course FAQ created',
    );
    return row;
  }
  async updateFaq(
    id: string,
    faqId: string,
    dto: UpdateFaqDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.faq(id, faqId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_FAQ_STALE_VERSION',
    );
    const row = await this.prisma.courseFaq.update({
      where: { id: faqId },
      data: {
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        status: dto.status ?? current.status,
        displayOrder: dto.displayOrder ?? current.displayOrder,
      },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'FAQ_UPDATE',
      { faqId },
      { faqId },
      'Course FAQ updated',
    );
    return row;
  }
  async removeFaq(
    id: string,
    faqId: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.faq(id, faqId);
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_FAQ_STALE_VERSION',
    );
    await this.prisma.courseFaq.update({
      where: { id: faqId },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'FAQ_DELETE',
      { faqId: current.id },
      { deleted: true },
      'Course FAQ deleted',
    );
    return { deleted: true };
  }

  async listRelated(id: string) {
    await this.adminCourse(id);
    return (
      await this.prisma.relatedCourse.findMany({
        where: { courseId: id },
        include: {
          relatedCourse: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
            },
          },
        },
        orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      })
    ).map((row) => ({
      id: row.id,
      relatedCourse: row.relatedCourse,
      relationshipType: row.relationshipType,
      displayOrder: row.displayOrder,
    }));
  }
  async replaceRelated(
    id: string,
    dto: RelatedCourseReplacementDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.adminCourse(id);
    version(current.updatedAt, dto.expectedUpdatedAt, 'COURSE_STALE_VERSION');
    const ids = dto.related.map((item) => item.relatedCourseId);
    if (ids.includes(id) || new Set(ids).size !== ids.length)
      throw catalogConflict(
        'COURSE_RELATED_INVALID',
        'Related courses cannot include the source course or duplicates',
      );
    const related = await this.prisma.course.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
    if (related.length !== ids.length)
      throw catalogNotFound(
        'COURSE_RELATED_NOT_FOUND',
        'One or more related courses were not found',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.relatedCourse.deleteMany({ where: { courseId: id } });
      if (dto.related.length)
        await tx.relatedCourse.createMany({
          data: dto.related.map((item, index) => ({
            courseId: id,
            relatedCourseId: item.relatedCourseId,
            relationshipType: item.relationshipType ?? 'RELATED',
            displayOrder: item.displayOrder ?? index,
          })),
        });
      await tx.course.update({
        where: { id },
        data: { updatedAt: new Date(), updatedByUserId: userId },
      });
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'RELATED_REPLACE',
      null,
      { count: dto.related.length },
      'Related courses replaced',
    );
    return this.listRelated(id);
  }

  async getSeo(id: string) {
    await this.adminCourse(id);
    return this.getSeoFor(id);
  }
  async putSeo(id: string, dto: SeoMetadataDto, request: AuthenticatedRequest) {
    const userId = actor(request);
    await this.adminCourse(id);
    if (!isHttps(dto.canonicalUrl))
      throw catalogBadRequest(
        'SEO_URL_INVALID',
        'Canonical URL must use HTTPS',
      );
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'COURSE', ownerId: id } },
    });
    const row = await this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: 'COURSE', ownerId: id } },
      create: this.seoData(id, dto),
      update: this.seoData(id, dto),
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'SEO_UPSERT',
      current ? { seoTitle: current.seoTitle } : null,
      { seoTitle: row.seoTitle },
      'Course SEO saved',
    );
    return this.toSeo(row);
  }
  async deleteSeo(
    id: string,
    dto: CourseActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    await this.adminCourse(id);
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'COURSE', ownerId: id } },
    });
    if (!current) return { deleted: false };
    version(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'COURSE_SEO_STALE_VERSION',
    );
    await this.prisma.seoMetadata.delete({ where: { id: current.id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE',
      id,
      'SEO_DELETE',
      { seoTitle: current.seoTitle },
      null,
      'Course SEO deleted',
    );
    return { deleted: true };
  }

  private publicMappingWhere(
    countrySlug?: string,
  ): Prisma.CountryCourseWhereInput {
    return {
      status: 'ACTIVE',
      deletedAt: null,
      availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
      sourceReference: { not: null },
      verifiedAt: { not: null },
      country: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(countrySlug ? { slug: countrySlug } : {}),
      },
    };
  }
  private publicWhere(query: CourseListQueryDto): Prisma.CourseWhereInput {
    const mapping: Prisma.CountryCourseWhereInput = {
      ...this.publicMappingWhere(query.country),
      ...(query.minTuition
        ? {
            indicativeTuitionMin: { gte: new Prisma.Decimal(query.minTuition) },
          }
        : {}),
      ...(query.maxTuition
        ? {
            indicativeTuitionMax: { lte: new Prisma.Decimal(query.maxTuition) },
          }
        : {}),
      ...(query.scholarshipAvailable !== undefined
        ? { scholarshipAvailable: query.scholarshipAvailable }
        : {}),
      ...(query.intake
        ? {
            intakes: {
              some: {
                status: 'ACTIVE',
                intake: { status: 'ACTIVE', slug: query.intake },
              },
            },
          }
        : {}),
    };
    return {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { shortName: { contains: query.q } },
              { shortDescription: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.subject
        ? {
            subject: {
              slug: query.subject,
              status: 'PUBLISHED',
              deletedAt: null,
            },
          }
        : {}),
      ...(query.subSubject
        ? {
            subSubject: {
              slug: query.subSubject,
              status: 'PUBLISHED',
              deletedAt: null,
            },
          }
        : {}),
      ...(query.level
        ? { courseLevel: { code: query.level, status: 'ACTIVE' } }
        : {}),
      ...(query.studyMode
        ? {
            studyModes: {
              some: { studyMode: { code: query.studyMode, status: 'ACTIVE' } },
            },
          }
        : {}),
      ...(query.country ||
      query.intake ||
      query.minTuition ||
      query.maxTuition ||
      query.scholarshipAvailable !== undefined
        ? { countryCourses: { some: mapping } }
        : { countryCourses: { some: this.publicMappingWhere() } }),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
  }
  private adminWhere(query: CourseListQueryDto): Prisma.CourseWhereInput {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { courseCode: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.subject ? { subject: { slug: query.subject } } : {}),
      ...(query.subSubject ? { subSubject: { slug: query.subSubject } } : {}),
      ...(query.level ? { courseLevel: { code: query.level } } : {}),
      ...(query.country
        ? {
            countryCourses: {
              some: { country: { slug: query.country }, deletedAt: null },
            },
          }
        : {}),
      ...(query.studyMode
        ? { studyModes: { some: { studyMode: { code: query.studyMode } } } }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
  }
  private publicOrderBy(
    sort?: string,
  ): Prisma.CourseOrderByWithRelationInput[] {
    if (sort === 'name') return [{ name: 'asc' }, { id: 'asc' }];
    if (sort === 'newest') return [{ publishedAt: 'desc' }, { id: 'asc' }];
    if (sort === 'duration') return [{ durationMin: 'asc' }, { name: 'asc' }];
    if (sort === 'popularity')
      return [{ popularityScore: 'desc' }, { name: 'asc' }];
    if (sort === 'tuition-low')
      return [{ countryCourses: { _count: 'asc' } }, { name: 'asc' }];
    return [
      { isFeatured: 'desc' },
      { displayOrder: 'asc' },
      { name: 'asc' },
      { id: 'asc' },
    ];
  }
  private publicInclude(country?: string) {
    return {
      ...COURSE_PUBLIC_INCLUDE,
      countryCourses: {
        where: this.publicMappingWhere(country),
        include: {
          country: { select: { id: true, name: true, slug: true } },
          intakes: {
            where: { status: 'ACTIVE', intake: { status: 'ACTIVE' } },
            include: {
              intake: {
                select: { id: true, name: true, slug: true, shortLabel: true },
              },
            },
          },
        },
      },
    };
  }
  private async adminCourse(id: string): Promise<AdminCourse> {
    const row = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: COURSE_ADMIN_INCLUDE,
    });
    if (!row) throw catalogNotFound('COURSE_NOT_FOUND', 'Course not found');
    return row;
  }
  private async mapping(courseId: string, id: string) {
    await this.adminCourse(courseId);
    const row = await this.prisma.countryCourse.findFirst({
      where: { id, courseId, deletedAt: null },
      include: {
        country: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            deletedAt: true,
          },
        },
        intakes: { include: { intake: true } },
      },
    });
    if (!row)
      throw catalogNotFound(
        'COURSE_COUNTRY_NOT_FOUND',
        'Country-course mapping not found',
      );
    return row;
  }
  private async section(courseId: string, id: string) {
    await this.adminCourse(courseId);
    const row = await this.prisma.courseContentSection.findFirst({
      where: { id, courseId, deletedAt: null },
      include: { media: { select: MEDIA_SELECT } },
    });
    if (!row)
      throw catalogNotFound(
        'COURSE_SECTION_NOT_FOUND',
        'Content section not found',
      );
    return row;
  }
  private async faq(courseId: string, id: string) {
    await this.adminCourse(courseId);
    const row = await this.prisma.courseFaq.findFirst({
      where: { id, courseId, deletedAt: null },
    });
    if (!row) throw catalogNotFound('COURSE_FAQ_NOT_FOUND', 'FAQ not found');
    return row;
  }
  private async ensureCountry(id: string) {
    const row = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw catalogNotFound('COUNTRY_NOT_FOUND', 'Country not found');
    return row;
  }
  private async validateCoreReferences(
    subjectId: string,
    subSubjectId: string | undefined,
    levelId: string,
    mediaId?: string,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
    });
    if (!subject)
      throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    if (subSubjectId) {
      const child = await this.prisma.subSubject.findFirst({
        where: { id: subSubjectId, subjectId, deletedAt: null },
      });
      if (!child)
        throw catalogConflict(
          'COURSE_SUBJECT_MISMATCH',
          'Sub-Subject must belong to the selected Subject',
        );
    }
    const level = await this.prisma.courseLevel.findFirst({
      where: { id: levelId, status: 'ACTIVE' },
    });
    if (!level)
      throw catalogConflict(
        'COURSE_LEVEL_INACTIVE',
        'Course Level must be active',
      );
    if (mediaId) {
      const mediaRow = await this.prisma.mediaAsset.findFirst({
        where: {
          id: mediaId,
          status: 'ACTIVE',
          mediaType: 'IMAGE',
          deletedAt: null,
        },
      });
      if (!mediaRow)
        throw catalogConflict(
          'MEDIA_INVALID',
          'Selected media is not an active image',
        );
    }
  }
  private validateDuration(min?: string, max?: string) {
    if (
      (min !== undefined && Number(min) < 0) ||
      (max !== undefined && Number(max) < 0)
    )
      throw catalogBadRequest(
        'COURSE_DURATION_INVALID',
        'Duration values must be non-negative',
      );
    rangeError(min, max, 'COURSE_DURATION_INVALID', 'Duration');
  }
  private validatePopularity(value?: string) {
    if (value !== undefined && (Number(value) < 0 || Number(value) > 100))
      throw catalogBadRequest(
        'COURSE_POPULARITY_INVALID',
        'Popularity score must be between 0 and 100',
      );
  }
  private async validateMapping(
    dto: CreateCountryCourseDto | UpdateCountryCourseDto,
  ) {
    rangeError(
      dto.indicativeTuitionMin,
      dto.indicativeTuitionMax,
      'COURSE_MAPPING_RANGE_INVALID',
      'Tuition',
    );
    rangeError(
      dto.applicationFeeMin,
      dto.applicationFeeMax,
      'COURSE_MAPPING_RANGE_INVALID',
      'Application fee',
    );
    rangeError(
      dto.durationMinOverride,
      dto.durationMaxOverride,
      'COURSE_MAPPING_RANGE_INVALID',
      'Duration',
    );
    if (
      (dto.availabilityStatus ?? 'AVAILABLE') !== 'UNAVAILABLE' &&
      (!dto.sourceReference || !dto.verifiedAt)
    )
      throw catalogConflict(
        'COURSE_MAPPING_SOURCE_REQUIRED',
        'Available mappings require an HTTPS source and verification date',
      );
    if (!isHttps(dto.sourceReference))
      throw catalogBadRequest(
        'COURSE_MAPPING_SOURCE_INVALID',
        'Source reference must use HTTPS',
      );
    if (dto.verifiedAt && new Date(dto.verifiedAt) > new Date())
      throw catalogBadRequest(
        'COURSE_MAPPING_VERIFICATION_INVALID',
        'Verification date cannot be in the future',
      );
    if (
      dto.academicMinPercentage !== undefined &&
      Number(dto.academicMinPercentage) > 100
    )
      throw catalogBadRequest(
        'COURSE_MAPPING_RANGE_INVALID',
        'Academic percentage cannot exceed 100',
      );
    if (dto.academicMinCgpa !== undefined && Number(dto.academicMinCgpa) > 10)
      throw catalogBadRequest(
        'COURSE_MAPPING_RANGE_INVALID',
        'CGPA cannot exceed 10',
      );
  }
  private mappingData(
    courseId: string,
    dto: CreateCountryCourseDto | UpdateCountryCourseDto,
  ): Prisma.CountryCourseUncheckedCreateInput {
    return {
      courseId,
      countryId: dto.countryId,
      availabilityStatus: dto.availabilityStatus ?? 'AVAILABLE',
      indicativeTuitionMin: toDecimal(dto.indicativeTuitionMin),
      indicativeTuitionMax: toDecimal(dto.indicativeTuitionMax),
      currencyCode: dto.currencyCode,
      tuitionPeriod: dto.tuitionPeriod ?? 'PER_YEAR',
      applicationFeeMin: toDecimal(dto.applicationFeeMin),
      applicationFeeMax: toDecimal(dto.applicationFeeMax),
      durationMinOverride: toDecimal(dto.durationMinOverride),
      durationMaxOverride: toDecimal(dto.durationMaxOverride),
      durationUnitOverride: dto.durationUnitOverride,
      academicMinPercentage: toDecimal(dto.academicMinPercentage),
      academicMinCgpa: toDecimal(dto.academicMinCgpa),
      ieltsMinScore: toDecimal(dto.ieltsMinScore),
      pteMinScore: toDecimal(dto.pteMinScore),
      toeflMinScore: toDecimal(dto.toeflMinScore),
      duolingoMinScore: toDecimal(dto.duolingoMinScore),
      workExperienceMonths: dto.workExperienceMonths,
      scholarshipAvailable: dto.scholarshipAvailable ?? false,
      admissionRequirements: dto.admissionRequirements?.trim(),
      englishRequirements: dto.englishRequirements?.trim(),
      applicationNotes: dto.applicationNotes?.trim(),
      careerOpportunities: dto.careerOpportunities?.trim(),
      sourceReference: dto.sourceReference?.trim(),
      verifiedAt: dto.verifiedAt ? new Date(dto.verifiedAt) : undefined,
      status: dto.status ?? 'ACTIVE',
      isFeatured: dto.isFeatured ?? false,
      displayOrder: dto.displayOrder ?? 0,
    };
  }
  private async validateSection(
    dto: CreateContentSectionDto | UpdateContentSectionDto,
  ) {
    if (
      !COURSE_SECTION_KEYS.includes(dto.sectionKey as any) ||
      !COURSE_SECTION_TYPES.includes(dto.sectionType as any)
    )
      throw catalogBadRequest(
        'COURSE_SECTION_INVALID',
        'Unsupported course content section',
      );
    if (dto.bodyJson && JSON.stringify(dto.bodyJson).length > 50000)
      throw catalogBadRequest(
        'COURSE_SECTION_INVALID',
        'Content section body is too large',
      );
    if (dto.bodyJson && JSON.stringify(dto.bodyJson).includes('<'))
      throw catalogBadRequest(
        'COURSE_SECTION_INVALID',
        'HTML is not allowed in course content',
      );
    if (dto.mediaId) {
      const row = await this.prisma.mediaAsset.findFirst({
        where: {
          id: dto.mediaId,
          status: 'ACTIVE',
          mediaType: 'IMAGE',
          deletedAt: null,
        },
      });
      if (!row)
        throw catalogConflict(
          'MEDIA_INVALID',
          'Selected media is not an active image',
        );
    }
  }
  private async publishReadiness(course: AdminCourse) {
    const errors: Array<{ field: string; message: string }> = [];
    if (!course.name || !course.slug)
      errors.push({
        field: 'core',
        message: 'Course name and slug are required',
      });
    if (course.subject.status !== 'PUBLISHED' || course.subject.deletedAt)
      errors.push({ field: 'subject', message: 'Subject must be published' });
    if (
      course.subSubjectId &&
      (!course.subSubject ||
        course.subSubject.status !== 'PUBLISHED' ||
        course.subSubject.deletedAt)
    )
      errors.push({
        field: 'subSubject',
        message: 'Sub-Subject must be published',
      });
    if (course.courseLevel.status !== 'ACTIVE')
      errors.push({
        field: 'courseLevel',
        message: 'Course Level must be active',
      });
    if (!course.studyModes.some((row) => row.studyMode.status === 'ACTIVE'))
      errors.push({
        field: 'studyModes',
        message: 'At least one active Study Mode is required',
      });
    const valid = course.countryCourses.filter(
      (row: any) =>
        row.status === 'ACTIVE' &&
        row.deletedAt === null &&
        ['AVAILABLE', 'LIMITED'].includes(row.availabilityStatus) &&
        row.country.status === 'PUBLISHED' &&
        !row.country.deletedAt &&
        row.sourceReference &&
        row.verifiedAt,
    );
    if (!valid.length)
      errors.push({
        field: 'countries',
        message:
          'At least one verified available published country mapping is required',
      });
    return errors;
  }
  private toPublicList(row: any, country?: string) {
    const mappings = row.countryCourses ?? [];
    const selected = country
      ? mappings.find((mapping: any) => mapping.country?.slug === country)
      : null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortName: row.shortName,
      qualificationName: row.qualificationName,
      shortDescription: row.shortDescription,
      subject: row.subject,
      subSubject:
        row.subSubject?.status === 'PUBLISHED' && !row.subSubject.deletedAt
          ? {
              id: row.subSubject.id,
              name: row.subSubject.name,
              slug: row.subSubject.slug,
            }
          : null,
      courseLevel: row.courseLevel,
      studyModes: row.studyModes
        ?.filter((item: any) => item.studyMode.status === 'ACTIVE')
        .map((item: any) => item.studyMode),
      duration: {
        min: decimal(row.durationMin),
        max: decimal(row.durationMax),
        unit: row.durationUnit,
      },
      credits: decimal(row.credits),
      featuredMedia: media(row.featuredMedia),
      featured: row.isFeatured,
      availableCountryCount: mappings.length,
      selectedCountry: selected?.country
        ? {
            id: selected.country.id,
            name: selected.country.name,
            slug: selected.country.slug,
          }
        : null,
      selectedTuition: selected
        ? {
            min: decimal(selected.indicativeTuitionMin),
            max: decimal(selected.indicativeTuitionMax),
            currencyCode: selected.currencyCode,
            period: selected.tuitionPeriod,
          }
        : null,
      selectedIntakes:
        selected?.intakes?.map((item: any) => this.toIntake(item)) ?? [],
      scholarshipAvailable: selected?.scholarshipAvailable ?? null,
      displayOrder: row.displayOrder,
    };
  }
  private toPublicMapping(row: any) {
    return {
      id: row.id,
      country: row.country,
      availabilityStatus: row.availabilityStatus,
      tuition: {
        min: decimal(row.indicativeTuitionMin),
        max: decimal(row.indicativeTuitionMax),
        currencyCode: row.currencyCode,
        period: row.tuitionPeriod,
      },
      applicationFee: {
        min: decimal(row.applicationFeeMin),
        max: decimal(row.applicationFeeMax),
        currencyCode: row.currencyCode,
      },
      duration: {
        min: decimal(row.durationMinOverride),
        max: decimal(row.durationMaxOverride),
        unit: row.durationUnitOverride,
      },
      academicRequirements: {
        percentage: decimal(row.academicMinPercentage),
        cgpa: decimal(row.academicMinCgpa),
      },
      englishRequirements: {
        ielts: decimal(row.ieltsMinScore),
        pte: decimal(row.pteMinScore),
        toefl: decimal(row.toeflMinScore),
        duolingo: decimal(row.duolingoMinScore),
      },
      workExperienceMonths: row.workExperienceMonths,
      scholarshipAvailable: row.scholarshipAvailable,
      admissionRequirements: row.admissionRequirements,
      englishRequirementsText: row.englishRequirements,
      applicationNotes: row.applicationNotes,
      careerOpportunities: row.careerOpportunities,
      sourceReference: row.sourceReference,
      verifiedAt: date(row.verifiedAt),
      intakes: row.intakes?.map((item: any) => this.toIntake(item)) ?? [],
    };
  }
  private toIntake(row: any) {
    return {
      id: row.id,
      intake: row.intake
        ? {
            id: row.intake.id,
            name: row.intake.name,
            slug: row.intake.slug,
            shortLabel: row.intake.shortLabel,
          }
        : undefined,
      applicationDeadline: date(row.applicationDeadline),
      deadlineNotes: row.deadlineNotes,
      status: row.status,
    };
  }
  private sectionBody(
    dto: CreateContentSectionDto | UpdateContentSectionDto,
  ): Prisma.InputJsonValue {
    return {
      type: dto.sectionType,
      content: (dto.bodyJson ?? null) as Prisma.InputJsonValue,
    };
  }
  private sectionType(row: { bodyJson: unknown }): string {
    const value = row.bodyJson;
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { type?: unknown }).type === 'string'
      ? String((value as { type: string }).type)
      : 'RICH_TEXT';
  }
  private sectionContent(row: { bodyJson: unknown }): unknown {
    const value = row.bodyJson;
    return value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'content' in value
      ? ((value as { content?: unknown }).content ?? null)
      : value;
  }
  private toPublicSection(row: any) {
    return {
      id: row.id,
      sectionKey: row.sectionKey,
      sectionType: this.sectionType(row),
      heading: row.heading,
      subheading: row.subheading,
      bodyJson: this.sectionContent(row),
      media: media(row.media),
      displayOrder: row.displayOrder,
    };
  }
  private toAdminMapping(row: any) {
    return {
      id: row.id,
      country: row.country,
      availabilityStatus: row.availabilityStatus,
      indicativeTuitionMin: decimal(row.indicativeTuitionMin),
      indicativeTuitionMax: decimal(row.indicativeTuitionMax),
      currencyCode: row.currencyCode,
      tuitionPeriod: row.tuitionPeriod,
      applicationFeeMin: decimal(row.applicationFeeMin),
      applicationFeeMax: decimal(row.applicationFeeMax),
      durationMinOverride: decimal(row.durationMinOverride),
      durationMaxOverride: decimal(row.durationMaxOverride),
      durationUnitOverride: row.durationUnitOverride,
      academicMinPercentage: decimal(row.academicMinPercentage),
      academicMinCgpa: decimal(row.academicMinCgpa),
      ieltsMinScore: decimal(row.ieltsMinScore),
      pteMinScore: decimal(row.pteMinScore),
      toeflMinScore: decimal(row.toeflMinScore),
      duolingoMinScore: decimal(row.duolingoMinScore),
      workExperienceMonths: row.workExperienceMonths,
      scholarshipAvailable: row.scholarshipAvailable,
      admissionRequirements: row.admissionRequirements,
      englishRequirements: row.englishRequirements,
      applicationNotes: row.applicationNotes,
      careerOpportunities: row.careerOpportunities,
      sourceReference: row.sourceReference,
      verifiedAt: date(row.verifiedAt),
      status: row.status,
      isFeatured: row.isFeatured,
      displayOrder: row.displayOrder,
      updatedAt: date(row.updatedAt),
      intakes: row.intakes?.map((item: any) => this.toIntake(item)) ?? [],
    };
  }
  private toAdmin(row: AdminCourse) {
    return {
      id: row.id,
      subject: row.subject,
      subSubject: row.subSubject,
      courseLevel: row.courseLevel,
      name: row.name,
      shortName: row.shortName,
      qualificationName: row.qualificationName,
      slug: row.slug,
      courseCode: row.courseCode,
      shortDescription: row.shortDescription,
      overview: row.overview,
      durationMin: decimal(row.durationMin),
      durationMax: decimal(row.durationMax),
      durationUnit: row.durationUnit,
      credits: decimal(row.credits),
      featuredMedia: media(row.featuredMedia),
      careerSummary: row.careerSummary,
      featured: row.isFeatured,
      popularityScore: decimal(row.popularityScore),
      displayOrder: row.displayOrder,
      status: row.status,
      publishedAt: date(row.publishedAt),
      createdAt: date(row.createdAt),
      updatedAt: date(row.updatedAt),
      studyModes: row.studyModes.map((item: any) => item.studyMode),
      countries: row.countryCourses.map((item: any) =>
        this.toAdminMapping(item),
      ),
      contentSections: row.contentSections.map((item: any) =>
        this.toAdminSection(item),
      ),
      faqs: row.faqs,
      relatedCourses: row.relatedFrom.map((item: any) => ({
        id: item.id,
        relatedCourse: item.relatedCourse,
        relationshipType: item.relationshipType,
        displayOrder: item.displayOrder,
      })),
    };
  }
  private toAdminSection(row: any) {
    return {
      id: row.id,
      sectionKey: row.sectionKey,
      sectionType: this.sectionType(row),
      heading: row.heading,
      subheading: row.subheading,
      bodyJson: this.sectionContent(row),
      media: media(row.media),
      displayOrder: row.displayOrder,
      status: row.status,
      updatedAt: date(row.updatedAt),
      createdAt: date(row.createdAt),
    };
  }
  private toSeo(row: any) {
    return row
      ? {
          id: row.id,
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          seoTitle: row.seoTitle,
          metaDescription: row.metaDescription,
          canonicalUrl: row.canonicalUrl,
          focusKeyword: row.focusKeyword,
          ogTitle: row.ogTitle,
          ogDescription: row.ogDescription,
          twitterTitle: row.twitterTitle,
          twitterDescription: row.twitterDescription,
          robotsIndex: row.robotsIndex,
          robotsFollow: row.robotsFollow,
          schemaJson: row.schemaJson,
          hreflangJson: row.hreflangJson,
          ogMedia: media(row.ogMedia),
          twitterMedia: media(row.twitterMedia),
          createdAt: date(row.createdAt),
          updatedAt: date(row.updatedAt),
        }
      : null;
  }
  private async getSeoFor(id: string) {
    return this.toSeo(
      await this.prisma.seoMetadata.findUnique({
        where: { ownerType_ownerId: { ownerType: 'COURSE', ownerId: id } },
        include: {
          ogMedia: { select: MEDIA_SELECT },
          twitterMedia: { select: MEDIA_SELECT },
        },
      }),
    );
  }
  private seoData(
    ownerId: string,
    dto: SeoMetadataDto,
  ): Prisma.SeoMetadataUncheckedCreateInput {
    return {
      ownerType: 'COURSE',
      ownerId,
      seoTitle: dto.seoTitle.trim(),
      metaDescription: dto.metaDescription.trim(),
      canonicalUrl: dto.canonicalUrl?.trim(),
      focusKeyword: dto.focusKeyword?.trim(),
      ogTitle: dto.ogTitle?.trim(),
      ogDescription: dto.ogDescription?.trim(),
      ogMediaId: dto.ogMediaId,
      twitterTitle: dto.twitterTitle?.trim(),
      twitterDescription: dto.twitterDescription?.trim(),
      twitterMediaId: dto.twitterMediaId,
      robotsIndex: dto.robotsIndex ?? true,
      robotsFollow: dto.robotsFollow ?? true,
      schemaJson: dto.schemaJson as Prisma.InputJsonValue | undefined,
      hreflangJson: dto.hreflangJson as Prisma.InputJsonValue | undefined,
    };
  }
  private courseJsonLd(course: any, seo: any) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.name,
      description: course.shortDescription ?? undefined,
      url: seo?.canonicalUrl ?? `/courses/${course.slug}`,
      provider: { '@type': 'Organization', name: 'Universta' },
    };
  }
}

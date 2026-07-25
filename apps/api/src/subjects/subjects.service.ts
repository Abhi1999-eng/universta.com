import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  catalogConflict,
  catalogNotFound,
  catalogNotReady,
} from '../catalog/catalog.errors';
import {
  isUniqueConstraintError,
  paginationMeta,
  slugify,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type {
  CreateSubSubjectDto,
  CreateSubjectDto,
  SeoMetadataDto,
  SubjectActionDto,
  SubjectListQueryDto,
  SubSubjectListQueryDto,
  UpdateSubSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';

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
const SUBJECT_INCLUDE = {
  iconMedia: { select: MEDIA_SELECT },
  listingMedia: { select: MEDIA_SELECT },
  heroMedia: { select: MEDIA_SELECT },
} satisfies Prisma.SubjectInclude;
const SUB_SUBJECT_INCLUDE = {
  iconMedia: { select: MEDIA_SELECT },
  listingMedia: { select: MEDIA_SELECT },
  subject: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
} satisfies Prisma.SubSubjectInclude;

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
type SubjectRecord = Prisma.SubjectGetPayload<{
  include: typeof SUBJECT_INCLUDE;
}>;
type SubSubjectRecord = Prisma.SubSubjectGetPayload<{
  include: typeof SUB_SUBJECT_INCLUDE;
}>;

function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}

function media(record: MediaRecord) {
  return record && record.status === 'ACTIVE' && !record.deletedAt
    ? {
        id: record.id,
        url: record.publicUrl,
        alt: record.altText ?? record.title ?? '',
        title: record.title,
        width: record.width,
        height: record.height,
      }
    : null;
}

function versionMatches(
  current: Date,
  expected: string | undefined,
  code: string,
): void {
  if (expected && current.getTime() !== new Date(expected).getTime())
    throw catalogConflict(
      code,
      'The record changed in another session. Reload before saving',
    );
}

function validUrl(value: string | undefined): boolean {
  return !value || /^https?:\/\//i.test(value);
}

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async publicList(query: SubjectListQueryDto) {
    const where: Prisma.SubjectWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { shortDescription: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        include: SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: await Promise.all(rows.map((row) => this.toPublic(row))),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async publicDetail(slug: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: SUBJECT_INCLUDE,
    });
    if (!subject)
      throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    const [children, levels, featuredCourses, countries, seo] =
      await Promise.all([
        this.prisma.subSubject.findMany({
          where: {
            subjectId: subject.id,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          include: SUB_SUBJECT_INCLUDE,
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        }),
        this.prisma.course.groupBy({
          by: ['courseLevelId'],
          where: {
            subjectId: subject.id,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          _count: { _all: true },
        }),
        this.prisma.course.findMany({
          where: {
            subjectId: subject.id,
            status: 'PUBLISHED',
            deletedAt: null,
            isFeatured: true,
          },
          include: this.coursePublicInclude(),
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
          take: 6,
        }),
        this.prisma.countryCourse.findMany({
          where: {
            course: {
              subjectId: subject.id,
              status: 'PUBLISHED',
              deletedAt: null,
            },
            status: 'ACTIVE',
            availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
            sourceReference: { not: null },
            verifiedAt: { not: null },
            country: { status: 'PUBLISHED', deletedAt: null },
          },
          select: { countryId: true },
          distinct: ['countryId'],
        }),
        this.prisma.seoMetadata.findUnique({
          where: {
            ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: subject.id },
          },
          include: {
            ogMedia: { select: MEDIA_SELECT },
            twitterMedia: { select: MEDIA_SELECT },
          },
        }),
      ]);
    const levelIds = levels.map((row) => row.courseLevelId);
    const levelNames = levelIds.length
      ? await this.prisma.courseLevel.findMany({
          where: { id: { in: levelIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
    return {
      ...(await this.toPublic(subject)),
      subSubjects: children.map((child) => this.toSubSubjectPublic(child)),
      courseCountsByLevel: levels.map((row) => ({
        level: levelNames.find((level) => level.id === row.courseLevelId) ?? {
          id: row.courseLevelId,
          name: 'Course level',
          code: null,
        },
        count: row._count._all,
      })),
      featuredCourses: featuredCourses.map((course) =>
        this.toCourseCard(course),
      ),
      availableCountryCount: countries.length,
      seo: this.toSeo(seo),
    };
  }

  async adminList(query: SubjectListQueryDto) {
    const where: Prisma.SubjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        include: SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
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
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: SUBJECT_INCLUDE,
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return this.toAdmin(row);
  }

  async create(dto: CreateSubjectDto, request: AuthenticatedRequest) {
    const userId = actorId(request);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.validateMedia([
      dto.iconMediaId,
      dto.listingMediaId,
      dto.heroMediaId,
    ]);
    try {
      const row = await this.prisma.subject.create({
        data: {
          name,
          slug,
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          iconMediaId: dto.iconMediaId,
          listingMediaId: dto.listingMediaId,
          heroMediaId: dto.heroMediaId,
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUBJECT',
        row.id,
        'CREATE',
        null,
        { name, slug, status: row.status },
        'Subject created',
      );
      return this.toAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUBJECT_CONFLICT',
          'Subject name or slug already exists',
        );
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.subjectRecord(id);
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    await this.validateMedia([
      dto.iconMediaId,
      dto.listingMediaId,
      dto.heroMediaId,
    ]);
    const data: Prisma.SubjectUncheckedUpdateInput = {
      name: dto.name.trim(),
      slug: dto.slug?.trim() || current.slug,
      ...(dto.shortDescription !== undefined
        ? { shortDescription: dto.shortDescription.trim() }
        : {}),
      ...(dto.overview !== undefined ? { overview: dto.overview.trim() } : {}),
      ...(dto.iconMediaId !== undefined
        ? { iconMediaId: dto.iconMediaId }
        : {}),
      ...(dto.listingMediaId !== undefined
        ? { listingMediaId: dto.listingMediaId }
        : {}),
      ...(dto.heroMediaId !== undefined
        ? { heroMediaId: dto.heroMediaId }
        : {}),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.displayOrder !== undefined
        ? { displayOrder: dto.displayOrder }
        : {}),
      updatedByUserId: userId,
    };
    try {
      const row = await this.prisma.subject.update({
        where: { id },
        data,
        include: SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUBJECT',
        id,
        'UPDATE',
        { name: current.name, slug: current.slug, status: current.status },
        { name: row.name, slug: row.slug, status: row.status },
        'Subject updated',
      );
      return this.toAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUBJECT_CONFLICT',
          'Subject name or slug already exists',
        );
      throw error;
    }
  }

  async publish(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const errors: Array<{ field: string; message: string }> = [];
    if (!row.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!row.slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!row.shortDescription)
      errors.push({
        field: 'shortDescription',
        message: 'Short description is required',
      });
    if (errors.length)
      throw catalogNotReady(
        'SUBJECT_NOT_READY',
        'Complete subject fields before publishing',
        errors,
      );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'PUBLISH',
      { status: row.status },
      { status: updated.status },
      'Subject published',
    );
    return this.toAdmin(updated);
  }
  async unpublish(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'UNPUBLISH',
      { status: row.status },
      { status: updated.status },
      'Subject unpublished',
    );
    return this.toAdmin(updated);
  }
  async remove(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const count = await this.prisma.course.count({
      where: { subjectId: id, deletedAt: null },
    });
    if (count)
      throw catalogConflict(
        'SUBJECT_IN_USE',
        'A subject referenced by courses cannot be deleted',
      );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DRAFT',
        publishedAt: null,
        updatedByUserId: userId,
      },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'DELETE',
      { name: row.name, status: row.status },
      { deleted: true, status: updated.status },
      'Subject soft-deleted',
    );
    return { deleted: true };
  }

  async adminSubSubjectList(subjectId: string, query: SubSubjectListQueryDto) {
    await this.ensureSubject(subjectId);
    const where: Prisma.SubSubjectWhereInput = {
      subjectId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subSubject.count({ where }),
      this.prisma.subSubject.findMany({
        where,
        include: SUB_SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => this.toSubSubjectAdmin(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }
  async getSubSubject(subjectId: string, id: string) {
    await this.ensureSubject(subjectId);
    const row = await this.subSubjectRecord(subjectId, id);
    return this.toSubSubjectAdmin(row);
  }
  async createSubSubject(
    subjectId: string,
    dto: CreateSubSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.ensureSubject(subjectId);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.validateMedia([dto.iconMediaId, dto.listingMediaId]);
    try {
      const row = await this.prisma.subSubject.create({
        data: {
          subjectId,
          name,
          slug,
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          iconMediaId: dto.iconMediaId,
          listingMediaId: dto.listingMediaId,
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: SUB_SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUB_SUBJECT',
        row.id,
        'CREATE',
        null,
        { subjectId, name, slug, status: row.status },
        'Sub-Subject created',
      );
      return this.toSubSubjectAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUB_SUBJECT_CONFLICT',
          'Sub-Subject name within the subject or slug already exists',
        );
      throw error;
    }
  }
  async updateSubSubject(
    subjectId: string,
    id: string,
    dto: UpdateSubSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    await this.validateMedia([dto.iconMediaId, dto.listingMediaId]);
    try {
      const row = await this.prisma.subSubject.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          slug: dto.slug?.trim() || current.slug,
          ...(dto.shortDescription !== undefined
            ? { shortDescription: dto.shortDescription.trim() }
            : {}),
          ...(dto.overview !== undefined
            ? { overview: dto.overview.trim() }
            : {}),
          ...(dto.iconMediaId !== undefined
            ? { iconMediaId: dto.iconMediaId }
            : {}),
          ...(dto.listingMediaId !== undefined
            ? { listingMediaId: dto.listingMediaId }
            : {}),
          ...(dto.isFeatured !== undefined
            ? { isFeatured: dto.isFeatured }
            : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: userId,
        },
        include: SUB_SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUB_SUBJECT',
        id,
        'UPDATE',
        { name: current.name, slug: current.slug },
        { name: row.name, slug: row.slug },
        'Sub-Subject updated',
      );
      return this.toSubSubjectAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUB_SUBJECT_CONFLICT',
          'Sub-Subject name within the subject or slug already exists',
        );
      throw error;
    }
  }
  async publishSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const parent = await this.ensureSubject(subjectId);
    const errors: Array<{ field: string; message: string }> = [];
    if (!row.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!row.slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!row.shortDescription)
      errors.push({
        field: 'shortDescription',
        message: 'Short description is required',
      });
    if (parent.status !== 'PUBLISHED')
      errors.push({
        field: 'subject',
        message: 'The parent Subject must be published first',
      });
    if (errors.length)
      throw catalogNotReady(
        'SUB_SUBJECT_NOT_READY',
        'Complete sub-subject fields before publishing',
        errors,
      );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'PUBLISH',
      { status: row.status },
      { status: updated.status },
      'Sub-Subject published',
    );
    return this.toSubSubjectAdmin(updated);
  }
  async unpublishSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'UNPUBLISH',
      { status: row.status },
      { status: updated.status },
      'Sub-Subject unpublished',
    );
    return this.toSubSubjectAdmin(updated);
  }
  async removeSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const count = await this.prisma.course.count({
      where: { subSubjectId: id, deletedAt: null },
    });
    if (count)
      throw catalogConflict(
        'SUB_SUBJECT_IN_USE',
        'A sub-subject referenced by courses cannot be deleted',
      );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DRAFT',
        publishedAt: null,
        updatedByUserId: userId,
      },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'DELETE',
      { name: row.name, status: row.status },
      { deleted: true, status: updated.status },
      'Sub-Subject soft-deleted',
    );
    return { deleted: true };
  }

  async getSeo(id: string) {
    await this.subjectRecord(id);
    return this.getSeoFor('SUBJECT', id);
  }
  async putSeo(id: string, dto: SeoMetadataDto, request: AuthenticatedRequest) {
    const userId = actorId(request);
    await this.subjectRecord(id);
    if (!validUrl(dto.canonicalUrl))
      throw catalogConflict(
        'SEO_URL_INVALID',
        'Canonical URL must use HTTP or HTTPS',
      );
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
    });
    const row = await this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
      create: this.seoData(id, 'SUBJECT', dto),
      update: this.seoData(id, 'SUBJECT', dto),
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'SEO_UPSERT',
      current ? { seoTitle: current.seoTitle } : null,
      { seoTitle: row.seoTitle, metaDescription: row.metaDescription },
      'Subject SEO saved',
    );
    return this.toSeo(row);
  }
  async deleteSeo(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.subjectRecord(id);
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
    });
    if (!current) return { deleted: false };
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_SEO_STALE_VERSION',
    );
    await this.prisma.seoMetadata.delete({ where: { id: current.id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'SEO_DELETE',
      { seoTitle: current.seoTitle },
      null,
      'Subject SEO deleted',
    );
    return { deleted: true };
  }

  private async subjectRecord(id: string) {
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: SUBJECT_INCLUDE,
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return row;
  }
  private async subSubjectRecord(subjectId: string, id: string) {
    const row = await this.prisma.subSubject.findFirst({
      where: { id, subjectId, deletedAt: null },
      include: SUB_SUBJECT_INCLUDE,
    });
    if (!row)
      throw catalogNotFound('SUB_SUBJECT_NOT_FOUND', 'Sub-Subject not found');
    return row;
  }
  private async ensureSubject(id: string) {
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return row;
  }
  private async validateMedia(ids: Array<string | undefined>) {
    const requested = ids.filter((id): id is string => Boolean(id));
    if (!requested.length) return;
    const count = await this.prisma.mediaAsset.count({
      where: {
        id: { in: requested },
        status: 'ACTIVE',
        mediaType: 'IMAGE',
        deletedAt: null,
      },
    });
    if (count !== requested.length)
      throw catalogConflict(
        'MEDIA_INVALID',
        'Selected media is not an active image',
      );
  }
  private orderBy(sort?: string): Array<{
    displayOrder?: 'asc' | 'desc';
    name?: 'asc' | 'desc';
    createdAt?: 'asc' | 'desc';
    updatedAt?: 'asc' | 'desc';
    id?: 'asc' | 'desc';
  }> {
    if (sort === 'name') return [{ name: 'asc' }, { id: 'asc' }];
    if (sort === 'createdAt') return [{ createdAt: 'desc' }, { id: 'asc' }];
    if (sort === 'updatedAt') return [{ updatedAt: 'desc' }, { id: 'asc' }];
    return [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
  }
  private coursePublicInclude() {
    return {
      subject: { select: { id: true, name: true, slug: true } },
      subSubject: { select: { id: true, name: true, slug: true } },
      courseLevel: { select: { id: true, name: true, code: true } },
      featuredMedia: { select: MEDIA_SELECT },
      studyModes: {
        include: {
          studyMode: { select: { id: true, name: true, code: true } },
        },
      },
    } satisfies Prisma.CourseInclude;
  }
  private async toPublic(row: SubjectRecord) {
    const [courseCount, subSubjectCount, countries] = await Promise.all([
      this.prisma.course.count({
        where: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.subSubject.count({
        where: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.countryCourse.findMany({
        where: {
          course: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
          status: 'ACTIVE',
          availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
          sourceReference: { not: null },
          verifiedAt: { not: null },
          country: { status: 'PUBLISHED', deletedAt: null },
        },
        select: { countryId: true },
        distinct: ['countryId'],
      }),
    ]);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      heroMedia: media(row.heroMedia),
      featured: row.isFeatured,
      displayOrder: row.displayOrder,
      publishedCourseCount: courseCount,
      publishedSubSubjectCount: subSubjectCount,
      availableCountryCount: countries.length,
    };
  }
  private toAdmin(row: SubjectRecord) {
    return {
      ...this.toAdminBase(row),
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      heroMedia: media(row.heroMedia),
    };
  }
  private toAdminBase(row: SubjectRecord) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      isFeatured: row.isFeatured,
      displayOrder: row.displayOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private toSubSubjectPublic(row: SubSubjectRecord) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      featured: row.isFeatured,
      displayOrder: row.displayOrder,
    };
  }
  private toSubSubjectAdmin(row: SubSubjectRecord) {
    return {
      ...this.toSubSubjectPublic(row),
      subject: {
        id: row.subject.id,
        name: row.subject.name,
        slug: row.subject.slug,
      },
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
  private toCourseCard(row: any) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortName: row.shortName,
      qualificationName: row.qualificationName,
      subject: row.subject,
      subSubject: row.subSubject,
      courseLevel: row.courseLevel,
      studyModes: row.studyModes?.map((item: any) => item.studyMode),
      duration: {
        min: row.durationMin?.toString() ?? null,
        max: row.durationMax?.toString() ?? null,
        unit: row.durationUnit,
      },
      credits: row.credits?.toString() ?? null,
      featured: row.isFeatured,
      featuredMedia: media(row.featuredMedia),
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
          createdAt: row.createdAt?.toISOString(),
          updatedAt: row.updatedAt?.toISOString(),
        }
      : null;
  }
  private async getSeoFor(ownerType: string, ownerId: string) {
    return this.toSeo(
      await this.prisma.seoMetadata.findUnique({
        where: { ownerType_ownerId: { ownerType, ownerId } },
        include: {
          ogMedia: { select: MEDIA_SELECT },
          twitterMedia: { select: MEDIA_SELECT },
        },
      }),
    );
  }
  private seoData(
    ownerId: string,
    ownerType: string,
    dto: SeoMetadataDto,
  ): Prisma.SeoMetadataUncheckedCreateInput {
    return {
      ownerId,
      ownerType,
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
}

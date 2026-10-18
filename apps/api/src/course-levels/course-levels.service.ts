import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  catalogBadRequest,
  catalogConflict,
  catalogNotFound,
} from '../catalog/catalog.errors';
import {
  isUniqueConstraintError,
  paginationMeta,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  SUBJECT_LEVEL_PAGE_SEO_OWNER,
  publicLevelSlug,
} from '../subjects/level-pages.shared';
import type {
  CreateMasterDto,
  MasterActionDto,
  MasterListQueryDto,
  UpdateMasterDto,
} from './dto/master.dto';
function actor(request: AuthenticatedRequest) {
  const id = request.user?.sub;
  if (!id)
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}
function version(current: Date, expected: string | undefined) {
  if (expected && current.getTime() !== new Date(expected).getTime())
    throw catalogConflict(
      'COURSE_LEVEL_STALE_VERSION',
      'The course level changed in another session. Reload before saving',
    );
}
/**
 * Where a level is used, for the admin's list: the subjects and
 * specializations that tick it, the courses and university programmes at
 * it, and the level pages an editor has written copy for. Deleted records
 * don't count.
 */
export const LEVEL_USAGE = {
  subjects: { where: { subject: { deletedAt: null } } },
  subSubjects: { where: { subSubject: { deletedAt: null } } },
  courses: { where: { deletedAt: null } },
  universityCourseOfferings: { where: { deletedAt: null } },
  levelPages: true,
} satisfies Prisma.CourseLevelCountOutputTypeSelect;
@Injectable()
export class CourseLevelsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A level's page sits right after its field: /subjects/computing/masters.
   * A specialization sits there too (/subjects/computing/ai), and the site
   * reads the path as a specialization first, so a level whose address one
   * already uses would have no page under that subject. Specializations
   * are kept off the levels' addresses when they are named; this is the
   * same rule from the level's side, for a new code (a level's code is
   * fixed once it is created).
   */
  private async assertCodeFree(code: string) {
    const taken = await this.prisma.subSubject.findFirst({
      where: {
        deletedAt: null,
        slug: { in: [...new Set([publicLevelSlug(code), code.toLowerCase()])] },
      },
      select: { name: true, slug: true, subject: { select: { name: true } } },
    });
    if (taken)
      throw catalogConflict(
        'COURSE_LEVEL_SLUG_TAKEN',
        `The specialization "${taken.name}" under ${taken.subject.name} already uses the address "${taken.slug}". Rename that specialization first`,
      );
  }
  async publicList() {
    return this.prisma.courseLevel.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        educationOrder: true,
        displayOrder: true,
      },
      orderBy: [
        { educationOrder: 'asc' },
        { displayOrder: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
    });
  }
  async adminList(query: MasterListQueryDto) {
    const where: Prisma.CourseLevelWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { code: { contains: query.q } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.courseLevel.count({ where }),
      this.prisma.courseLevel.findMany({
        where,
        include: { _count: { select: LEVEL_USAGE } },
        orderBy: [
          { educationOrder: 'asc' },
          { displayOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const data = rows.map(({ _count, ...row }) => ({
      ...row,
      slug: publicLevelSlug(row.code),
      usage: {
        subjects: _count.subjects,
        specializations: _count.subSubjects,
        courses: _count.courses,
        programmes: _count.universityCourseOfferings,
        levelPages: _count.levelPages,
      },
    }));
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }
  async getAdmin(id: string) {
    const row = await this.prisma.courseLevel.findUnique({ where: { id } });
    if (!row)
      throw catalogNotFound('COURSE_LEVEL_NOT_FOUND', 'Course level not found');
    return row;
  }
  async create(dto: CreateMasterDto, request: AuthenticatedRequest) {
    const userId = actor(request);
    await this.assertCodeFree(dto.code);
    try {
      const row = await this.prisma.courseLevel.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          educationOrder: dto.educationOrder ?? 0,
          displayOrder: dto.displayOrder ?? 0,
          status: dto.status ?? 'ACTIVE',
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE_LEVEL',
        row.id,
        'CREATE',
        null,
        { code: row.code, name: row.name, status: row.status },
        'Course level created',
      );
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'COURSE_LEVEL_CONFLICT',
          'Course level code or name already exists',
        );
      throw error;
    }
  }
  async update(
    id: string,
    dto: UpdateMasterDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.getAdmin(id);
    version(current.updatedAt, dto.expectedUpdatedAt);
    // A level's pages and links are built from its code (/subjects/x/masters),
    // so the code is fixed once the level exists. Re-sending it unchanged is
    // fine; the admin's older forms still do.
    if (
      dto.code !== undefined &&
      dto.code.toUpperCase() !== current.code.toUpperCase()
    )
      throw catalogBadRequest(
        'COURSE_LEVEL_CODE_LOCKED',
        "A study level's code can't be changed after it is created, because its pages and links are built from it. Change the name instead",
        { code: current.code },
      );
    if (dto.status === 'INACTIVE' && current.status !== 'INACTIVE') {
      const dependent = await this.prisma.course.count({
        where: { courseLevelId: id, status: 'PUBLISHED', deletedAt: null },
      });
      if (dependent)
        throw catalogConflict(
          'COURSE_LEVEL_IN_USE',
          'A level used by published courses cannot be inactivated',
        );
    }
    try {
      const row = await this.prisma.courseLevel.update({
        where: { id },
        data: {
          code: current.code,
          name: dto.name ?? current.name,
          description: dto.description,
          educationOrder: dto.educationOrder ?? current.educationOrder,
          displayOrder: dto.displayOrder ?? current.displayOrder,
          status: dto.status ?? current.status,
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'COURSE_LEVEL',
        id,
        dto.status === 'INACTIVE' ? 'DEACTIVATE' : 'UPDATE',
        { code: current.code, name: current.name, status: current.status },
        { code: row.code, name: row.name, status: row.status },
        'Course level updated',
      );
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'COURSE_LEVEL_CONFLICT',
          'Course level code or name already exists',
        );
      throw error;
    }
  }
  async remove(
    id: string,
    dto: MasterActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actor(request);
    const current = await this.getAdmin(id);
    version(current.updatedAt, dto.expectedUpdatedAt);
    const dependent = await this.prisma.course.count({
      where: { courseLevelId: id },
    });
    if (dependent)
      throw catalogConflict(
        'COURSE_LEVEL_IN_USE',
        'A course level referenced by courses cannot be deleted; inactivate it only when safe',
      );
    /* The level pages written for it go with it (cascaded by the schema),
       as its ticks do; their SEO rows have no foreign key and are removed
       here, together with the level. Switching a level off keeps them. */
    const levelPageIds = (
      await this.prisma.subjectLevelPage.findMany({
        where: { courseLevelId: id },
        select: { id: true },
      })
    ).map((page) => page.id);
    await this.prisma.$transaction([
      this.prisma.seoMetadata.deleteMany({
        where: {
          ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
          ownerId: { in: levelPageIds },
        },
      }),
      this.prisma.courseLevel.delete({ where: { id } }),
    ]);
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'COURSE_LEVEL',
      id,
      'DELETE',
      {
        code: current.code,
        name: current.name,
        levelPages: levelPageIds.length,
      },
      null,
      'Course level deleted',
    );
    return { deleted: true };
  }
}

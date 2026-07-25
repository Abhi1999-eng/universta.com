import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { catalogConflict, catalogNotFound } from '../catalog/catalog.errors';
import {
  isUniqueConstraintError,
  paginationMeta,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
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
      'STUDY_MODE_STALE_VERSION',
      'The study mode changed in another session. Reload before saving',
    );
}
@Injectable()
export class StudyModesService {
  constructor(private readonly prisma: PrismaService) {}
  async publicList() {
    return this.prisma.studyMode.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }
  async adminList(query: MasterListQueryDto) {
    const where: Prisma.StudyModeWhereInput = {
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
    const [total, data] = await Promise.all([
      this.prisma.studyMode.count({ where }),
      this.prisma.studyMode.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return { data, meta: paginationMeta(query.page, query.limit, total) };
  }
  async getAdmin(id: string) {
    const row = await this.prisma.studyMode.findUnique({ where: { id } });
    if (!row)
      throw catalogNotFound('STUDY_MODE_NOT_FOUND', 'Study mode not found');
    return row;
  }
  async create(dto: CreateMasterDto, request: AuthenticatedRequest) {
    const userId = actor(request);
    try {
      const row = await this.prisma.studyMode.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          displayOrder: dto.displayOrder ?? 0,
          status: dto.status ?? 'ACTIVE',
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'STUDY_MODE',
        row.id,
        'CREATE',
        null,
        { code: row.code, name: row.name, status: row.status },
        'Study mode created',
      );
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'STUDY_MODE_CONFLICT',
          'Study mode code or name already exists',
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
    if (dto.status === 'INACTIVE' && current.status !== 'INACTIVE') {
      const dependent = await this.prisma.courseStudyMode.count({
        where: {
          studyModeId: id,
          course: { status: 'PUBLISHED', deletedAt: null },
        },
      });
      if (dependent)
        throw catalogConflict(
          'STUDY_MODE_IN_USE',
          'A mode assigned to published courses cannot be inactivated',
        );
    }
    try {
      const row = await this.prisma.studyMode.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
          displayOrder: dto.displayOrder ?? current.displayOrder,
          status: dto.status ?? current.status,
        },
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'STUDY_MODE',
        id,
        dto.status === 'INACTIVE' ? 'DEACTIVATE' : 'UPDATE',
        { code: current.code, name: current.name, status: current.status },
        { code: row.code, name: row.name, status: row.status },
        'Study mode updated',
      );
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'STUDY_MODE_CONFLICT',
          'Study mode code or name already exists',
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
    const dependent = await this.prisma.courseStudyMode.count({
      where: { studyModeId: id },
    });
    if (dependent)
      throw catalogConflict(
        'STUDY_MODE_IN_USE',
        'A study mode referenced by courses cannot be deleted; inactivate it only when safe',
      );
    await this.prisma.studyMode.delete({ where: { id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'STUDY_MODE',
      id,
      'DELETE',
      { code: current.code, name: current.name },
      null,
      'Study mode deleted',
    );
    return { deleted: true };
  }
}

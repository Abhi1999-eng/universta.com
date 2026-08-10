import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from '../catalog/catalog.constants';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Intake and ScholarshipProvider previously had real models with public
 * read paths (used to populate dropdowns across the admin) but no admin
 * CRUD of their own -- both could only ever be seeded, never created or
 * edited from the UI. This gives both the same small, hand-rolled CRUD
 * shape as ConsultantLocation (see LocationsService) rather than the
 * heavier class-validator DTO pattern CourseLevel/StudyMode use, since
 * neither needs optimistic-concurrency versioning.
 */
function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class CatalogLookupsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Intakes ----------

  async adminListIntakes(query: { q?: string; status?: string }) {
    return this.prisma.intake.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim() ? { name: { contains: query.q.trim() } } : {}),
      },
      orderBy: [{ startMonth: 'asc' }, { name: 'asc' }],
    });
  }

  async adminDetailIntake(id: string) {
    const row = await this.prisma.intake.findUnique({ where: { id } });
    if (!row)
      throw new NotFoundException({
        code: 'INTAKE_NOT_FOUND',
        message: 'Intake not found',
        details: null,
      });
    return row;
  }

  async createIntake(body: {
    name: string;
    slug?: string;
    startMonth: number;
    endMonth: number;
    seasonName?: string | null;
    shortLabel?: string | null;
    description?: string | null;
    status?: string;
    displayOrder?: number;
  }) {
    const slug = body.slug?.trim() || slugify(body.name);
    try {
      return await this.prisma.intake.create({
        data: {
          name: body.name.trim(),
          slug,
          startMonth: body.startMonth,
          endMonth: body.endMonth,
          seasonName: body.seasonName || null,
          shortLabel: body.shortLabel || null,
          description: body.description || null,
          status: body.status ?? 'ACTIVE',
          displayOrder: body.displayOrder ?? 0,
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'INTAKE_NAME_TAKEN',
          message: 'An intake with this name or slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async updateIntake(
    id: string,
    body: {
      name?: string;
      slug?: string;
      startMonth?: number;
      endMonth?: number;
      seasonName?: string | null;
      shortLabel?: string | null;
      description?: string | null;
      status?: string;
      displayOrder?: number;
    },
  ) {
    await this.adminDetailIntake(id);
    try {
      return await this.prisma.intake.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.startMonth !== undefined
            ? { startMonth: body.startMonth }
            : {}),
          ...(body.endMonth !== undefined ? { endMonth: body.endMonth } : {}),
          ...(body.seasonName !== undefined
            ? { seasonName: body.seasonName || null }
            : {}),
          ...(body.shortLabel !== undefined
            ? { shortLabel: body.shortLabel || null }
            : {}),
          ...(body.description !== undefined
            ? { description: body.description || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.displayOrder !== undefined
            ? { displayOrder: body.displayOrder }
            : {}),
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'INTAKE_NAME_TAKEN',
          message: 'An intake with this name or slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async archiveIntake(id: string) {
    await this.adminDetailIntake(id);
    const inUse =
      (await this.prisma.countryIntake.count({ where: { intakeId: id } })) +
      (await this.prisma.universityCourseIntake.count({
        where: { intakeId: id },
      }));
    if (inUse > 0)
      throw new ConflictException({
        code: 'INTAKE_IN_USE',
        message: `${inUse} record${inUse === 1 ? '' : 's'} still reference this intake`,
        details: null,
      });
    return this.prisma.intake.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  // ---------- Scholarship providers ----------

  async adminListProviders(query: { q?: string; status?: string }) {
    return this.prisma.scholarshipProvider.findMany({
      where: {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.q?.trim() ? { name: { contains: query.q.trim() } } : {}),
      },
      include: { _count: { select: { scholarships: true } } },
      orderBy: [{ name: 'asc' }],
    });
  }

  async adminDetailProvider(id: string) {
    const row = await this.prisma.scholarshipProvider.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row)
      throw new NotFoundException({
        code: 'SCHOLARSHIP_PROVIDER_NOT_FOUND',
        message: 'Scholarship provider not found',
        details: null,
      });
    return row;
  }

  async createProvider(body: {
    name: string;
    slug?: string;
    websiteUrl?: string | null;
    sourceReference?: string | null;
    status?: string;
  }) {
    const slug = body.slug?.trim() || slugify(body.name);
    try {
      return await this.prisma.scholarshipProvider.create({
        data: {
          name: body.name.trim(),
          slug,
          websiteUrl: body.websiteUrl || null,
          sourceReference: body.sourceReference || null,
          status: body.status ?? 'ACTIVE',
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'SCHOLARSHIP_PROVIDER_NAME_TAKEN',
          message: 'A provider with this name or slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async updateProvider(
    id: string,
    body: {
      name?: string;
      slug?: string;
      websiteUrl?: string | null;
      sourceReference?: string | null;
      status?: string;
    },
  ) {
    await this.adminDetailProvider(id);
    try {
      return await this.prisma.scholarshipProvider.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.slug !== undefined ? { slug: body.slug.trim() } : {}),
          ...(body.websiteUrl !== undefined
            ? { websiteUrl: body.websiteUrl || null }
            : {}),
          ...(body.sourceReference !== undefined
            ? { sourceReference: body.sourceReference || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException({
          code: 'SCHOLARSHIP_PROVIDER_NAME_TAKEN',
          message: 'A provider with this name or slug already exists',
          details: null,
        });
      throw error;
    }
  }

  async archiveProvider(id: string) {
    await this.adminDetailProvider(id);
    const inUse = await this.prisma.scholarship.count({
      where: { providerId: id, deletedAt: null },
    });
    if (inUse > 0)
      throw new ConflictException({
        code: 'SCHOLARSHIP_PROVIDER_IN_USE',
        message: `${inUse} scholarship${inUse === 1 ? '' : 's'} still reference this provider`,
        details: null,
      });
    return this.prisma.scholarshipProvider.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async deleteProvider(id: string) {
    await this.adminDetailProvider(id);
    const inUse = await this.prisma.scholarship.count({
      where: { providerId: id },
    });
    if (inUse > 0)
      throw new ConflictException({
        code: 'SCHOLARSHIP_PROVIDER_IN_USE',
        message: `${inUse} scholarship${inUse === 1 ? '' : 's'} still reference this provider. Reassign or delete those scholarships before permanently deleting the provider.`,
        details: null,
      });
    return this.prisma.scholarshipProvider.delete({ where: { id } });
  }
}

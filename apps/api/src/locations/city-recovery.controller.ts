import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { PrismaService } from '../prisma/prisma.service';

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@ApiTags('locations-admin')
@ApiBearerAuth()
@Controller('admin/cities-recovery')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CityRecoveryAdminController {
  constructor(private readonly prisma: PrismaService) {}

  private async archivedCity(id: string) {
    const city = await this.prisma.city.findFirst({
      where: { id, deletedAt: { not: null } },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        state: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!city) {
      throw new NotFoundException({
        code: 'ARCHIVED_CITY_NOT_FOUND',
        message: 'Archived city not found',
        details: null,
      });
    }
    return city;
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('countryId') countryId?: string,
    @Query('q') q?: string,
  ) {
    const rows = await this.prisma.city.findMany({
      where: {
        deletedAt: { not: null },
        ...(countryId ? { countryId } : {}),
        ...(q?.trim() ? { name: { contains: q.trim() } } : {}),
      },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        state: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            campuses: true,
            consultantLocations: true,
            jobs: true,
            events: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    });
    return successEnvelope(req, rows);
  }

  @Patch(':id')
  async edit(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const current = await this.archivedCity(id);
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const slug = typeof body.slug === 'string' ? body.slug.trim() : undefined;
    const shortDescription =
      typeof body.shortDescription === 'string'
        ? body.shortDescription.trim()
        : undefined;
    const stateId =
      body.stateId === null || typeof body.stateId === 'string'
        ? (body.stateId as string | null)
        : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException({
        code: 'CITY_NAME_REQUIRED',
        message: 'City name cannot be empty',
        details: null,
      });
    }
    if (slug !== undefined && !slug) {
      throw new BadRequestException({
        code: 'CITY_SLUG_REQUIRED',
        message: 'City slug cannot be empty',
        details: null,
      });
    }
    if (stateId) {
      const state = await this.prisma.state.findFirst({
        where: {
          id: stateId,
          countryId: current.countryId,
          deletedAt: null,
        },
      });
      if (!state) {
        throw new BadRequestException({
          code: 'STATE_NOT_FOUND',
          message: 'The selected state does not belong to this country',
          details: null,
        });
      }
    }

    try {
      const updated = await this.prisma.city.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(slug !== undefined ? { slug } : {}),
          ...(shortDescription !== undefined
            ? { shortDescription: shortDescription || null }
            : {}),
          ...(stateId !== undefined ? { stateId: stateId || null } : {}),
          updatedByUserId: req.user?.sub ?? current.updatedByUserId,
        },
        include: {
          country: { select: { id: true, name: true, slug: true } },
          state: { select: { id: true, name: true, slug: true } },
        },
      });
      return successEnvelope(req, updated);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException({
          code: 'CITY_SLUG_TAKEN',
          message: 'A city with this slug already exists for this country',
          details: null,
        });
      }
      throw error;
    }
  }

  @Post(':id/restore')
  async restore(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const current = await this.archivedCity(id);
    const restored = await this.prisma.city.update({
      where: { id },
      data: {
        deletedAt: null,
        status: 'DRAFT',
        updatedByUserId: req.user?.sub ?? current.updatedByUserId,
      },
      include: {
        country: { select: { id: true, name: true, slug: true } },
        state: { select: { id: true, name: true, slug: true } },
      },
    });
    return successEnvelope(req, restored);
  }

  @Delete(':id')
  async removePermanently(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const current = await this.archivedCity(id);
    const references = await this.prisma.city.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            campuses: true,
            consultantLocations: true,
            jobs: true,
            events: true,
          },
        },
      },
    });
    const count = references?._count;
    const inUse =
      (count?.campuses ?? 0) +
      (count?.consultantLocations ?? 0) +
      (count?.jobs ?? 0) +
      (count?.events ?? 0);
    if (inUse > 0) {
      throw new ConflictException({
        code: 'CITY_IN_USE',
        message: `City cannot be permanently deleted because ${inUse} active record${inUse === 1 ? '' : 's'} still reference it. Restore it first and remove those relationships.`,
        details: count,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.seoMetadata.deleteMany({
        where: { ownerType: 'city', ownerId: id },
      });
      await tx.city.delete({ where: { id } });
    });

    return successEnvelope(req, {
      id: current.id,
      name: current.name,
      deleted: true,
    });
  }
}

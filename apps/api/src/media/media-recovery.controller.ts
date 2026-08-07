import {
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
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

function serializeAsset<T extends { fileSizeBytes: bigint }>(
  asset: T,
): Omit<T, 'fileSizeBytes'> & { fileSizeBytes: number } {
  return { ...asset, fileSizeBytes: Number(asset.fileSizeBytes) };
}

function isForeignKeyConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2003'
  );
}

@ApiTags('media-admin')
@ApiBearerAuth()
@Controller('admin/media-recovery')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class MediaRecoveryAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('folder') folder?: string,
  ) {
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        deletedAt: { not: null },
        ...(folder?.trim() ? { folder: folder.trim() } : {}),
        ...(q?.trim()
          ? {
              OR: [
                { title: { contains: q.trim() } },
                { altText: { contains: q.trim() } },
                { originalFileName: { contains: q.trim() } },
              ],
            }
          : {}),
      },
      orderBy: [{ deletedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return successEnvelope(req, rows.map(serializeAsset));
  }

  @Delete(':id')
  async removePermanently(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'ARCHIVED_MEDIA_NOT_FOUND',
        message: 'Archived media asset not found',
        details: null,
      });
    }

    try {
      await this.prisma.mediaAsset.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyConflict(error)) {
        throw new ConflictException({
          code: 'MEDIA_STILL_REFERENCED',
          message:
            'This archived media record is still referenced by another record and cannot be permanently deleted yet.',
          details: null,
        });
      }
      throw error;
    }

    return successEnvelope(req, {
      id: asset.id,
      title: asset.title,
      originalFileName: asset.originalFileName,
      deleted: true,
    });
  }
}

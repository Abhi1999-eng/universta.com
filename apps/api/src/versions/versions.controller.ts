import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import {
  VERSIONED_RESOURCES,
  VersionsService,
  type VersionedResource,
} from './versions.service';

function resourceOrThrow(value: string): VersionedResource {
  const upper = (value ?? '').toUpperCase() as VersionedResource;
  if (!VERSIONED_RESOURCES.includes(upper))
    throw new BadRequestException({
      code: 'VERSION_RESOURCE_UNSUPPORTED',
      message: `Version history is not kept for "${value}".`,
      details: null,
    });
  return upper;
}

function numberOrThrow(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${label} must be a version number.`,
      details: null,
    });
  return parsed;
}

@ApiTags('website-builder-admin')
@ApiBearerAuth()
@Controller('admin/content-versions')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class VersionsAdminController {
  constructor(private readonly versions: VersionsService) {}

  @Get(':resourceType/:resourceId')
  async list(
    @Req() req: AuthenticatedRequest,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit?: string,
  ) {
    return successEnvelope(
      req,
      await this.versions.list(
        resourceOrThrow(resourceType),
        resourceId,
        limit ? Number(limit) : undefined,
      ),
    );
  }

  @Get(':resourceType/:resourceId/compare')
  async compare(
    @Req() req: AuthenticatedRequest,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return successEnvelope(
      req,
      await this.versions.compare(
        resourceOrThrow(resourceType),
        resourceId,
        numberOrThrow(from, 'From'),
        numberOrThrow(to, 'To'),
      ),
    );
  }

  @Post(':resourceType/:resourceId/restore')
  async restore(
    @Req() req: AuthenticatedRequest,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Body() body: { versionNumber?: number },
  ) {
    return successEnvelope(
      req,
      await this.versions.restore(
        resourceOrThrow(resourceType),
        resourceId,
        numberOrThrow(String(body?.versionNumber ?? ''), 'Version'),
        req.user?.sub,
      ),
    );
  }
}

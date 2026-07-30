import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { InternalLinksService } from './internal-links.service';

@ApiTags('internal-links-admin')
@ApiBearerAuth()
@Controller('admin/internal-links')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class InternalLinksAdminController {
  constructor(private readonly service: InternalLinksService) {}

  @Get('search') async search(
    @Req() req: AuthenticatedRequest,
    @Query('q') q: string,
    @Query('entityType') entityType?: string,
  ) {
    return successEnvelope(req, await this.service.search(q ?? '', entityType));
  }

  @Get('resolve') async resolve(
    @Req() req: AuthenticatedRequest,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return successEnvelope(req, await this.service.resolve(entityType, entityId));
  }
}

@ApiTags('internal-links-public')
@Controller('phase1/internal-links')
export class InternalLinksPublicController {
  constructor(private readonly service: InternalLinksService) {}

  @Get('resolve') async resolve(
    @Req() req: RequestWithId,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return successEnvelope(
      req,
      await this.service.resolvePublic(entityType, entityId),
    );
  }
}

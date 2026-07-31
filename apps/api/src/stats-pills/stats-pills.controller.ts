import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { VersionsService } from '../versions/versions.service';
import { StatsPillsService } from './stats-pills.service';

@ApiTags('stats-pills-public')
@Controller('phase1/stats-pills')
export class StatsPillsPublicController {
  constructor(private readonly pills: StatsPillsService) {}
  @Get(':pageSlug')
  async get(@Req() req: RequestWithId, @Param('pageSlug') pageSlug: string) {
    return successEnvelope(req, await this.pills.publicForPage(pageSlug));
  }
}

@ApiTags('stats-pills-admin')
@ApiBearerAuth()
@Controller('admin/stats-pills')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StatsPillsAdminController {
  constructor(
    private readonly pills: StatsPillsService,
    private readonly versions: VersionsService,
  ) {}

  @Get(':pageId')
  async get(@Req() req: AuthenticatedRequest, @Param('pageId') pageId: string) {
    return successEnvelope(req, await this.pills.adminGet(pageId));
  }

  @Put(':pageId/draft')
  async draft(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
    @Body() body: { config?: unknown },
  ) {
    const current = await this.pills.adminGet(pageId);
    await this.versions.ensureBaseline(
      'PAGE_SECTION',
      current.section.id,
      req.user?.sub,
    );
    const result = await this.pills.saveDraft(
      pageId,
      body.config,
      req.user?.sub,
    );
    await this.versions.record({
      resourceType: 'PAGE_SECTION',
      resourceId: result.sectionId,
      changeSummary: 'Statistics pill draft saved',
      sourceAction: 'save-draft',
      actorUserId: req.user?.sub ?? null,
    });
    return successEnvelope(req, result);
  }

  @Post(':pageId/publish')
  async publish(
    @Req() req: AuthenticatedRequest,
    @Param('pageId') pageId: string,
  ) {
    const current = await this.pills.adminGet(pageId);
    await this.versions.ensureBaseline(
      'PAGE_SECTION',
      current.section.id,
      req.user?.sub,
    );
    const result = await this.pills.publish(pageId, req.user?.sub);
    await this.versions.record({
      resourceType: 'PAGE_SECTION',
      resourceId: result.sectionId,
      changeSummary: 'Statistics pill published',
      sourceAction: 'publish',
      actorUserId: req.user?.sub ?? null,
    });
    return successEnvelope(req, result);
  }
}

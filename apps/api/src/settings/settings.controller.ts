import {
  Body,
  Controller,
  Get,
  Param,
  Put,
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
import type { RequestWithId } from '../common/http.types';
import { VersionsService } from '../versions/versions.service';
import { SettingsService } from './settings.service';

@ApiTags('settings-public')
@Controller('phase1/settings')
export class SettingsPublicController {
  constructor(private readonly settings: SettingsService) {}

  @Get() async all(@Req() req: RequestWithId) {
    return successEnvelope(req, await this.settings.publicGetAll());
  }
}

/** Header + footer navigation and the settings both need, in one request. */
@ApiTags('settings-public')
@Controller('phase1/site-chrome')
export class SiteChromePublicController {
  constructor(private readonly settings: SettingsService) {}

  @Get() async chrome(@Req() req: RequestWithId, @Query('path') path?: string) {
    // `path` is optional: without it the caller gets the plain global chrome,
    // which is what every pre-existing consumer expects.
    return successEnvelope(req, await this.settings.publicChrome(path));
  }
}

@ApiTags('settings-admin')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SettingsAdminController {
  constructor(
    private readonly settings: SettingsService,
    private readonly versions: VersionsService,
  ) {}

  @Get() async all(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.settings.adminGetAll());
  }

  @Put(':group') async update(
    @Req() req: AuthenticatedRequest,
    @Param('group') group: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updated = await this.settings.update(group, body, req.user?.sub);
    // Only the two chrome groups are versioned: they are the ones the
    // Website Builder edits and the ones an admin would want to roll back.
    const versioned = {
      header: 'GLOBAL_HEADER',
      footer: 'GLOBAL_FOOTER',
    } as const;
    const resourceType = versioned[group as keyof typeof versioned];
    if (resourceType)
      await this.versions.record({
        resourceType,
        resourceId: group,
        changeSummary: `Global ${group} settings updated`,
        sourceAction: 'update',
        actorUserId: req.user?.sub ?? null,
      });
    return successEnvelope(req, updated);
  }
}

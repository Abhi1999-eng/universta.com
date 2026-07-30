import {
  Body,
  Controller,
  Get,
  Param,
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
import { SettingsService } from './settings.service';

@ApiTags('settings-public')
@Controller('phase1/settings')
export class SettingsPublicController {
  constructor(private readonly settings: SettingsService) {}

  @Get() async all(@Req() req: RequestWithId) {
    return successEnvelope(req, await this.settings.publicGetAll());
  }
}

@ApiTags('settings-admin')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Get() async all(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.settings.adminGetAll());
  }

  @Put(':group') async update(
    @Req() req: AuthenticatedRequest,
    @Param('group') group: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.settings.update(group, body, req.user?.sub),
    );
  }
}

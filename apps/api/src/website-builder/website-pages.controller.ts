import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { WebsitePagesService } from './website-pages.service';

@ApiTags('website-builder-admin')
@ApiBearerAuth()
@Controller('admin/website-pages')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class WebsitePagesAdminController {
  constructor(private readonly pages: WebsitePagesService) {}

  @Get() async list(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.pages.list());
  }

  /** Idempotent: safe to press repeatedly, converges on the same rows. */
  @Post('register-all') async registerAll(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.pages.registerAll(req.user?.sub));
  }

  @Get('templates/:templateKey/preview-entities') async previewEntities(
    @Req() req: AuthenticatedRequest,
    @Param('templateKey') templateKey: string,
  ) {
    return successEnvelope(req, await this.pages.previewEntities(templateKey));
  }

  @Post(':key/page') async ensurePage(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
  ) {
    return successEnvelope(
      req,
      await this.pages.ensurePage(key, req.user?.sub),
    );
  }
}

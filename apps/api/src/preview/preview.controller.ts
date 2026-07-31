import {
  Body,
  Controller,
  Get,
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
import { PreviewService } from './preview.service';

/** Issuing a preview token requires an authenticated Super Admin. */
@ApiTags('website-builder-admin')
@ApiBearerAuth()
@Controller('admin/preview-tokens')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PreviewAdminController {
  constructor(private readonly preview: PreviewService) {}

  @Post()
  async issue(
    @Req() req: AuthenticatedRequest,
    @Body() body: { target?: string; ref?: string },
  ) {
    return successEnvelope(
      req,
      await this.preview.issue(
        body?.target ?? 'page',
        body?.ref ?? '',
        req.user?.sub ?? '',
      ),
    );
  }
}

/** Redeeming one does not: the browser rendering the preview iframe has no
 * admin bearer token. The signed, scoped, short-lived token is the credential,
 * and an absent or expired token yields 403 rather than draft content. */
@ApiTags('phase1-public')
@Controller('phase1/preview')
export class PreviewPublicController {
  constructor(private readonly preview: PreviewService) {}

  @Get('page')
  async page(
    @Req() req: AuthenticatedRequest,
    @Query('slug') slug: string,
    @Query('token') token: string,
  ) {
    return successEnvelope(
      req,
      await this.preview.previewPage(slug ?? '', token ?? ''),
    );
  }
}

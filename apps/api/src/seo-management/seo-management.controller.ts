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
import { SeoManagementService } from './seo-management.service';
import type { SeoTemplateInput } from './seo-management.types';

@ApiTags('seo-management-public')
@Controller('phase1/seo-management')
export class SeoManagementPublicController {
  constructor(private readonly seo: SeoManagementService) {}

  @Get('defaults') async defaults(@Req() req: RequestWithId) {
    return successEnvelope(req, await this.seo.publicDefaults());
  }

  @Get('site-verification') async siteVerification(@Req() req: RequestWithId) {
    return successEnvelope(req, await this.seo.siteVerification());
  }
}

@ApiTags('seo-management-admin')
@ApiBearerAuth()
@Controller('admin/seo-management')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SeoManagementAdminController {
  constructor(private readonly seo: SeoManagementService) {}

  @Get('templates') async templates(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.seo.adminTemplates());
  }

  @Put('templates/:entityType') async saveTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Body() body: SeoTemplateInput,
  ) {
    return successEnvelope(req, await this.seo.saveTemplate(entityType, body));
  }

  @Post('templates/:entityType/preview') async preview(
    @Req() req: AuthenticatedRequest,
    @Param('entityType') entityType: string,
    @Body() body: SeoTemplateInput,
  ) {
    return successEnvelope(req, await this.seo.preview(entityType, body));
  }

  @Get('site-verification') async siteVerification(
    @Req() req: AuthenticatedRequest,
  ) {
    return successEnvelope(req, await this.seo.siteVerification());
  }

  @Put('site-verification') async saveSiteVerification(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.seo.saveSiteVerification(body, req.user?.sub),
    );
  }
}

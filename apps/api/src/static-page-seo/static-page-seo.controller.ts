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
import { StaticPageSeoService } from './static-page-seo.service';

@ApiTags('static-page-seo-public')
@Controller('phase1/static-page-seo')
export class StaticPageSeoPublicController {
  constructor(private readonly seo: StaticPageSeoService) {}

  @Get(':key') async get(@Req() req: RequestWithId, @Param('key') key: string) {
    return successEnvelope(req, await this.seo.publicGet(key));
  }
}

@ApiTags('static-page-seo-admin')
@ApiBearerAuth()
@Controller('admin/static-page-seo')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StaticPageSeoAdminController {
  constructor(private readonly seo: StaticPageSeoService) {}

  @Get() async list(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.seo.adminList());
  }

  @Put(':key') async save(
    @Req() req: AuthenticatedRequest,
    @Param('key') key: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(req, await this.seo.save(key, body));
  }
}

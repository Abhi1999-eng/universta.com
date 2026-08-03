import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { RedirectsService, type RedirectListQuery } from './redirects.service';

@ApiTags('redirects-admin')
@ApiBearerAuth()
@Controller('admin/redirects')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class RedirectsController {
  constructor(private readonly service: RedirectsService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: RedirectListQuery,
  ) {
    const result = await this.service.list(query);
    return successEnvelope(req, result.data, result.meta);
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.service.detail(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(req, await this.service.create(body, req));
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(req, await this.service.update(id, body, req));
  }

  @Post(':id/disable') async disable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.service.setActive(id, false, req));
  }

  @Post(':id/enable') async enable(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.service.setActive(id, true, req));
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.service.archive(id, req));
  }
}

/** Called by the web app's middleware on (almost) every request -- the only
 * place an admin-configured redirect actually takes effect. Unguarded like
 * the other `phase1/*` public endpoints; nothing it returns is sensitive
 * (an admin already chose to expose this exact source path by redirecting
 * it), and it needs to answer before a page has even started rendering. */
@ApiTags('redirects-public')
@Controller('phase1/redirects')
export class RedirectsPublicController {
  constructor(private readonly service: RedirectsService) {}

  @Get('lookup') async lookup(
    @Req() req: RequestWithId,
    @Query('sourcePath') sourcePath: string,
  ) {
    return successEnvelope(req, await this.service.lookup(sourcePath ?? ''));
  }
}

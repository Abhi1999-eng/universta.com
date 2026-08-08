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
import { successEnvelope } from '../catalog/catalog.responses';
import { CatalogLookupsService } from './catalog-lookups.service';

// Intake CRUD deliberately lives on the pre-existing AdminIntakesController
// (apps/api/src/countries/profiles/admin-country-profiles.controller.ts,
// registered at admin/intakes) rather than a new controller here, since
// that controller already owns the GET admin/intakes route consumed by
// every dropdown across the admin. See that file for create/update/archive.

@ApiTags('catalog-lookups-admin')
@ApiBearerAuth()
@Controller('admin/scholarship-providers')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ScholarshipProvidersAdminController {
  constructor(private readonly lookups: CatalogLookupsService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return successEnvelope(
      req,
      await this.lookups.adminListProviders({
        q: query.q,
        status: query.status,
      }),
    );
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.lookups.adminDetailProvider(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.lookups.createProvider({
        name: body.name as string,
        slug: body.slug as string | undefined,
        websiteUrl: body.websiteUrl as string | null | undefined,
        sourceReference: body.sourceReference as string | null | undefined,
        status: body.status as string | undefined,
      }),
    );
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.lookups.updateProvider(id, {
        name: body.name as string | undefined,
        slug: body.slug as string | undefined,
        websiteUrl: body.websiteUrl as string | null | undefined,
        sourceReference: body.sourceReference as string | null | undefined,
        status: body.status as string | undefined,
      }),
    );
  }

  @Delete(':id/permanent') async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.lookups.deleteProvider(id));
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.lookups.archiveProvider(id));
  }
}

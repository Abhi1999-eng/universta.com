import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { ExperimentsService } from './experiments.service';

@ApiTags('experiments-public')
@Controller('phase1/experiments')
export class ExperimentsPublicController {
  constructor(private readonly experiments: ExperimentsService) {}

  @Post('conversions') async convert(
    @Req() req: RequestWithId,
    @Body() body: { experimentKey?: string; kind?: string },
  ) {
    const header = req.headers['x-anon-id'];
    const anonymousId = Array.isArray(header) ? header[0] : header;
    if (body.experimentKey && body.kind)
      await this.experiments.recordConversion(
        body.experimentKey,
        anonymousId,
        body.kind,
      );
    return successEnvelope(req, { recorded: true });
  }
}

@ApiTags('experiments-admin')
@ApiBearerAuth()
@Controller('admin/experiments')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class ExperimentsAdminController {
  constructor(private readonly experiments: ExperimentsService) {}

  @Get() async list(@Req() req: AuthenticatedRequest) {
    return successEnvelope(req, await this.experiments.adminList());
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.experiments.adminDetail(id));
  }

  @Get(':id/stats') async stats(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.experiments.stats(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.experiments.createExperiment({
        key: body.key as string | undefined,
        name: body.name as string,
        description: body.description as string | undefined,
        sectionId: body.sectionId as string,
        status: body.status as string | undefined,
        startsAt: body.startsAt as string | null | undefined,
        endsAt: body.endsAt as string | null | undefined,
        createdByUserId: req.user?.sub,
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
      await this.experiments.updateExperiment(id, body),
    );
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.experiments.archiveExperiment(id));
  }

  @Post(':id/variants') async addVariant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.experiments.addVariant(id, {
        key: body.key as string | undefined,
        name: body.name as string,
        isControl: body.isControl as boolean | undefined,
        trafficWeight: body.trafficWeight as number | undefined,
        eyebrow: body.eyebrow as string | undefined,
        heading: body.heading as string | undefined,
        subheading: body.subheading as string | undefined,
        ctaPrimaryLabel: body.ctaPrimaryLabel as string | undefined,
        ctaPrimaryUrl: body.ctaPrimaryUrl as string | undefined,
      }),
    );
  }

  @Patch(':id/variants/:variantId') async updateVariant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.experiments.updateVariant(id, variantId, body),
    );
  }

  @Delete(':id/variants/:variantId') async removeVariant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return successEnvelope(
      req,
      await this.experiments.removeVariant(id, variantId),
    );
  }

  @Get(':id/variants/:variantId/preview') async previewVariant(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return successEnvelope(
      req,
      await this.experiments.previewVariant(id, variantId),
    );
  }
}

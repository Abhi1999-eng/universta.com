import {
  Body,
  Controller,
  Delete,
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
import {
  SeoMetadataDto,
  AdminSpecializationListQueryDto,
  SubjectActionDto,
} from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

/**
 * Specializations as records of their own, for the admin's list and editor
 * of them. Writing one still goes through its subject
 * (`/admin/subjects/:subjectId/sub-subjects/:id`), which the record names;
 * what is new here is reaching one without knowing its subject first, and
 * a specialization's own SEO.
 */
@ApiBearerAuth()
@ApiTags('admin-specializations')
@Controller('admin/specializations')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSpecializationsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get() async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: AdminSpecializationListQueryDto,
  ) {
    const result = await this.subjects.adminSpecializationList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Get(':id') async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.subjects.getSpecialization(id));
  }

  @Get(':id/seo') async getSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.getSpecializationSeo(id),
    );
  }
  @Put(':id/seo') async putSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SeoMetadataDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.putSpecializationSeo(id, dto, request),
    );
  }
  @Delete(':id/seo') async deleteSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.deleteSpecializationSeo(id, dto, request),
    );
  }
}

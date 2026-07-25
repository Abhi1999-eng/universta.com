import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  CreateSubSubjectDto,
  CreateSubjectDto,
  SeoMetadataDto,
  SubjectActionDto,
  SubjectListQueryDto,
  SubSubjectListQueryDto,
  UpdateSubSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

@ApiBearerAuth()
@ApiTags('admin-subjects')
@Controller('admin/subjects')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get() async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: SubjectListQueryDto,
  ) {
    const result = await this.subjects.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }
  @Post() async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSubjectDto,
  ) {
    return successEnvelope(request, await this.subjects.create(dto, request));
  }
  @Get(':id') async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.subjects.getAdmin(id));
  }
  @Patch(':id') async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.update(id, dto, request),
    );
  }
  @Post(':id/publish') async publish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.publish(id, dto, request),
    );
  }
  @Post(':id/unpublish') async unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.unpublish(id, dto, request),
    );
  }
  @Delete(':id') async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.remove(id, dto, request),
    );
  }

  @Get(':subjectId/sub-subjects') async listChildren(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Query() query: SubSubjectListQueryDto,
  ) {
    const result = await this.subjects.adminSubSubjectList(subjectId, query);
    return successEnvelope(request, result.data, result.meta);
  }
  @Post(':subjectId/sub-subjects') async createChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateSubSubjectDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.createSubSubject(subjectId, dto, request),
    );
  }
  @Get(':subjectId/sub-subjects/:id') async getChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.getSubSubject(subjectId, id),
    );
  }
  @Patch(':subjectId/sub-subjects/:id') async updateChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSubSubjectDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.updateSubSubject(subjectId, id, dto, request),
    );
  }
  @Post(':subjectId/sub-subjects/:id/publish') async publishChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.publishSubSubject(subjectId, id, dto, request),
    );
  }
  @Post(':subjectId/sub-subjects/:id/unpublish') async unpublishChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.unpublishSubSubject(subjectId, id, dto, request),
    );
  }
  @Delete(':subjectId/sub-subjects/:id') async removeChild(
    @Req() request: AuthenticatedRequest,
    @Param('subjectId') subjectId: string,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.removeSubSubject(subjectId, id, dto, request),
    );
  }

  @Get(':id/seo') async getSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.subjects.getSeo(id));
  }
  @Put(':id/seo') async putSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SeoMetadataDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.putSeo(id, dto, request),
    );
  }
  @Delete(':id/seo') async deleteSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.deleteSeo(id, dto, request),
    );
  }
}

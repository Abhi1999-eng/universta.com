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
  TaxonomyCountriesDto,
  UpdateSubSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { UpsertLevelPageDto } from './dto/level-page.dto';
import { SubjectLevelPagesService } from './level-pages.service';
import { SubjectsService } from './subjects.service';

@ApiBearerAuth()
@ApiTags('admin-subjects')
@Controller('admin/subjects')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSubjectsController {
  constructor(
    private readonly subjects: SubjectsService,
    private readonly levelPages: SubjectLevelPagesService,
  ) {}

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

  /* The destinations the subject is listed for. */
  @Get(':id/countries') async countries(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.listSubjectCountries(id),
    );
  }
  @Put(':id/countries') async putCountries(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: TaxonomyCountriesDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.putSubjectCountries(id, dto, request),
    );
  }

  /* The study levels' own pages under this subject: one per level it is
     offered at. `:courseLevelId` is looked up rather than checked as a v4
     UUID -- the Foundation and Pathway levels were made by MySQL's UUID(). */
  @Get(':id/level-pages') async levelPageList(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.list({ kind: 'subject', id }),
    );
  }
  @Get(':id/level-pages/:courseLevelId') async levelPage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('courseLevelId') courseLevelId: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.get({ kind: 'subject', id }, courseLevelId),
    );
  }
  @Put(':id/level-pages/:courseLevelId') async putLevelPage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('courseLevelId') courseLevelId: string,
    @Body() dto: UpsertLevelPageDto,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.upsert(
        { kind: 'subject', id },
        courseLevelId,
        dto,
        request,
      ),
    );
  }
  @Delete(':id/level-pages/:courseLevelId') async deleteLevelPage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('courseLevelId') courseLevelId: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.remove(
        { kind: 'subject', id },
        courseLevelId,
        dto,
        request,
      ),
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

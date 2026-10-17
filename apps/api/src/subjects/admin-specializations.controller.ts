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
  SeoMetadataDto,
  AdminSpecializationListQueryDto,
  CreateSpecializationFaqDto,
  CreateSpecializationSectionDto,
  SubjectActionDto,
  TaxonomyCountriesDto,
  UpdateSpecializationFaqDto,
  UpdateSpecializationSectionDto,
} from './dto/subject.dto';
import { UpsertLevelPageDto } from './dto/level-page.dto';
import { SubjectLevelPagesService } from './level-pages.service';
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
  constructor(
    private readonly subjects: SubjectsService,
    private readonly levelPages: SubjectLevelPagesService,
  ) {}

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
  /* The destinations the specialization is listed for. */
  @Get(':id/countries') async countries(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.listSpecializationCountries(id),
    );
  }
  @Put(':id/countries') async putCountries(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: TaxonomyCountriesDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.putSpecializationCountries(id, dto, request),
    );
  }

  /* Its own content: sections and FAQs, as a course has. */
  @Get(':id/content-sections') async sections(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.listSpecializationSections(id),
    );
  }
  @Post(':id/content-sections') async createSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSpecializationSectionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.createSpecializationSection(id, dto, request),
    );
  }
  @Patch(':id/content-sections/:sectionId') async updateSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSpecializationSectionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.updateSpecializationSection(
        id,
        sectionId,
        dto,
        request,
      ),
    );
  }
  @Delete(':id/content-sections/:sectionId') async deleteSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.removeSpecializationSection(
        id,
        sectionId,
        dto,
        request,
      ),
    );
  }
  @Get(':id/faqs') async faqs(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.listSpecializationFaqs(id),
    );
  }
  @Post(':id/faqs') async createFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSpecializationFaqDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.createSpecializationFaq(id, dto, request),
    );
  }
  @Patch(':id/faqs/:faqId') async updateFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateSpecializationFaqDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.updateSpecializationFaq(id, faqId, dto, request),
    );
  }
  @Delete(':id/faqs/:faqId') async deleteFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: SubjectActionDto,
  ) {
    return successEnvelope(
      request,
      await this.subjects.removeSpecializationFaq(id, faqId, dto, request),
    );
  }

  /* The study levels' own pages under this specialization: one per level it is
     offered at. `:courseLevelId` is looked up rather than checked as a v4
     UUID -- the Foundation and Pathway levels were made by MySQL's UUID(). */
  @Get(':id/level-pages') async levelPageList(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.list({ kind: 'specialization', id }),
    );
  }
  @Get(':id/level-pages/:courseLevelId') async levelPage(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('courseLevelId') courseLevelId: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.get({ kind: 'specialization', id }, courseLevelId),
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
        { kind: 'specialization', id },
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
        { kind: 'specialization', id },
        courseLevelId,
        dto,
        request,
      ),
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

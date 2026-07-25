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
  CreateContentSectionDto,
  CreateCountryCourseDto,
  CreateCourseDto,
  CreateFaqDto,
  CourseActionDto,
  CourseListQueryDto,
  IntakeReplacementDto,
  RelatedCourseReplacementDto,
  StudyModeReplacementDto,
  UpdateContentSectionDto,
  UpdateCountryCourseDto,
  UpdateCourseDto,
  UpdateFaqDto,
} from './dto/course.dto';
import { SeoMetadataDto } from '../subjects/dto/subject.dto';
import { CoursesService } from './courses.service';
@ApiBearerAuth()
@ApiTags('admin-courses')
@Controller('admin/courses')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get() async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CourseListQueryDto,
  ) {
    const result = await this.courses.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }
  @Post() async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCourseDto,
  ) {
    return successEnvelope(request, await this.courses.create(dto, request));
  }
  @Get(':id') async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.getAdmin(id));
  }
  @Patch(':id') async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.update(id, dto, request),
    );
  }
  @Post(':id/publish') async publish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.publish(id, dto, request),
    );
  }
  @Post(':id/unpublish') async unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.unpublish(id, dto, request),
    );
  }
  @Delete(':id') async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.remove(id, dto, request),
    );
  }
  @Put(':id/study-modes') async modes(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: StudyModeReplacementDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.replaceStudyModes(id, dto, request),
    );
  }

  @Get(':id/countries') async mappings(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.listMappings(id));
  }
  @Post(':id/countries') async createMapping(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateCountryCourseDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.createMapping(id, dto, request),
    );
  }
  @Patch(':id/countries/:mappingId') async updateMapping(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
    @Body() dto: UpdateCountryCourseDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.updateMapping(id, mappingId, dto, request),
    );
  }
  @Delete(':id/countries/:mappingId') async deleteMapping(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.removeMapping(id, mappingId, dto, request),
    );
  }
  @Get(':id/countries/:mappingId/intakes') async intakes(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
  ) {
    return successEnvelope(
      request,
      await this.courses.listIntakes(id, mappingId),
    );
  }
  @Put(':id/countries/:mappingId/intakes') async replaceIntakes(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
    @Body() dto: IntakeReplacementDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.replaceIntakes(id, mappingId, dto, request),
    );
  }

  @Get(':id/content-sections') async sections(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.listSections(id));
  }
  @Post(':id/content-sections') async createSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateContentSectionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.createSection(id, dto, request),
    );
  }
  @Patch(':id/content-sections/:sectionId') async updateSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateContentSectionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.updateSection(id, sectionId, dto, request),
    );
  }
  @Delete(':id/content-sections/:sectionId') async deleteSection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.removeSection(id, sectionId, dto, request),
    );
  }
  @Get(':id/faqs') async faqs(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.listFaqs(id));
  }
  @Post(':id/faqs') async createFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateFaqDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.createFaq(id, dto, request),
    );
  }
  @Patch(':id/faqs/:faqId') async updateFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.updateFaq(id, faqId, dto, request),
    );
  }
  @Delete(':id/faqs/:faqId') async deleteFaq(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('faqId') faqId: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.removeFaq(id, faqId, dto, request),
    );
  }
  @Get(':id/related') async related(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.listRelated(id));
  }
  @Put(':id/related') async replaceRelated(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RelatedCourseReplacementDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.replaceRelated(id, dto, request),
    );
  }
  @Get(':id/seo') async seo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.courses.getSeo(id));
  }
  @Put(':id/seo') async putSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SeoMetadataDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.putSeo(id, dto, request),
    );
  }
  @Delete(':id/seo') async deleteSeo(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CourseActionDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.deleteSeo(id, dto, request),
    );
  }
}

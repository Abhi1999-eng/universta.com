import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  SpecializationListQueryDto,
  SpecializationUniversitiesQueryDto,
  SubjectListQueryDto,
} from './dto/subject.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List published subjects' })
  async list(
    @Req() request: RequestWithId,
    @Query() query: SubjectListQueryDto,
  ) {
    const result = await this.subjects.publicList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  /* Declared before the specialization itself, like the route below it is
     declared before ':slug', so the longer address is matched first. */
  @Get(':subjectSlug/specializations/:slug/universities')
  @ApiOperation({
    summary: 'List the universities that teach a specialization',
  })
  async specializationUniversities(
    @Req() request: RequestWithId,
    @Param('subjectSlug') subjectSlug: string,
    @Param('slug') slug: string,
    @Query() query: SpecializationUniversitiesQueryDto,
  ) {
    const result = await this.subjects.publicSpecializationUniversities(
      subjectSlug,
      slug,
      query,
    );
    return successEnvelope(request, result.data, result.meta);
  }

  /* Declared before ':slug' so "specializations" is not read as a subject. */
  @Get(':subjectSlug/specializations/:slug')
  @ApiOperation({ summary: 'Get a published specialization within a subject' })
  async specialization(
    @Req() request: RequestWithId,
    @Param('subjectSlug') subjectSlug: string,
    @Param('slug') slug: string,
  ) {
    return successEnvelope(
      request,
      await this.subjects.publicSpecialization(subjectSlug, slug),
    );
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published subject by slug' })
  async detail(@Req() request: RequestWithId, @Param('slug') slug: string) {
    return successEnvelope(request, await this.subjects.publicDetail(slug));
  }
}

/** The flat view: students search for the branch, not the field it sits in. */
@ApiTags('subjects')
@Controller('specializations')
export class SpecializationsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List published specializations across subjects' })
  async list(
    @Req() request: RequestWithId,
    @Query() query: SpecializationListQueryDto,
  ) {
    const result = await this.subjects.publicSpecializationList(query);
    return successEnvelope(request, result.data, result.meta);
  }
}

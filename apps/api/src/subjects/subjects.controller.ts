import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  SpecializationListQueryDto,
  SpecializationUniversitiesQueryDto,
  SubjectListQueryDto,
} from './dto/subject.dto';
import { SubjectLevelPagesService } from './level-pages.service';
import { SubjectsService } from './subjects.service';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly subjects: SubjectsService,
    private readonly levelPages: SubjectLevelPagesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List published subjects' })
  async list(
    @Req() request: RequestWithId,
    @Query() query: SubjectListQueryDto,
  ) {
    const result = await this.subjects.publicList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  /* A study level's page within a specialization, then within a subject.
     `:level` is a code ("PG"), a readable slug ("masters") or
     "undergraduate". Declared before the specialization and ':slug', as
     the longer addresses here are. */
  @Get(':subjectSlug/specializations/:slug/level-pages/:level')
  @ApiOperation({
    summary: "Get a specialization's page at one study level",
  })
  async specializationLevelPage(
    @Req() request: RequestWithId,
    @Param('subjectSlug') subjectSlug: string,
    @Param('slug') slug: string,
    @Param('level') level: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.publicPage(subjectSlug, level, slug),
    );
  }

  @Get(':subjectSlug/level-pages/:level')
  @ApiOperation({ summary: "Get a subject's page at one study level" })
  async levelPage(
    @Req() request: RequestWithId,
    @Param('subjectSlug') subjectSlug: string,
    @Param('level') level: string,
  ) {
    return successEnvelope(
      request,
      await this.levelPages.publicPage(subjectSlug, level),
    );
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

/** Every published level page the sitemap may list, with whether its own
 * words are enough for search and its robots setting. */
@ApiTags('subjects')
@Controller('subject-level-pages')
export class SubjectLevelPagesController {
  constructor(private readonly levelPages: SubjectLevelPagesService) {}

  @Get()
  @ApiOperation({ summary: 'List the published study level pages' })
  async list(@Req() request: RequestWithId) {
    const result = await this.levelPages.publicIndex();
    return successEnvelope(request, result.data, {
      total: result.total,
      templateRobotsIndex: result.templateRobotsIndex,
    });
  }
}

/** Every destination page of a subject or a specialization the sitemap may
 * list, with how many programmes each has. A path of its own: under
 * /countries or /subjects it would be read as a country or a subject slug. */
@ApiTags('subjects')
@Controller('country-field-pages')
export class CountryFieldPagesController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the country subject and country specialization pages',
  })
  async list(@Req() request: RequestWithId) {
    const result = await this.subjects.publicCountryFieldPages();
    return successEnvelope(request, result.data, { total: result.total });
  }
}

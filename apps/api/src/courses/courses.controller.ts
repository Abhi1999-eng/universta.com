import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  CourseListQueryDto,
  CourseSuggestionsQueryDto,
} from './dto/course.dto';
import { CoursesService } from './courses.service';
@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}
  @Get('filter-options')
  @ApiOperation({ summary: 'List database-backed public course filters' })
  async filterOptions(
    @Req() request: RequestWithId,
    @Query() query: CourseListQueryDto,
  ) {
    return successEnvelope(
      request,
      await this.courses.publicFilterOptions(query),
    );
  }
  @Get('suggestions')
  @ApiOperation({ summary: 'Suggest published courses' })
  async suggestions(
    @Req() request: RequestWithId,
    @Query() query: CourseSuggestionsQueryDto,
  ) {
    return successEnvelope(request, await this.courses.suggestions(query.q));
  }
  @Get() @ApiOperation({ summary: 'List published courses' }) async list(
    @Req() request: RequestWithId,
    @Query() query: CourseListQueryDto,
  ) {
    const result = await this.courses.publicList(query);
    return successEnvelope(request, result.data, result.meta);
  }
  @Get(':slug')
  @ApiOperation({ summary: 'Get a published course by slug' })
  async detail(
    @Req() request: RequestWithId,
    @Param('slug') slug: string,
    @Query('country') country?: string,
  ) {
    return successEnvelope(
      request,
      await this.courses.publicDetail(slug, country),
    );
  }
}

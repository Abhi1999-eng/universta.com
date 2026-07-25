import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { SubjectListQueryDto } from './dto/subject.dto';
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

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published subject by slug' })
  async detail(@Req() request: RequestWithId, @Param('slug') slug: string) {
    return successEnvelope(request, await this.subjects.publicDetail(slug));
  }
}

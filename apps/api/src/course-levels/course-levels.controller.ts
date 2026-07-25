import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { CourseLevelsService } from './course-levels.service';
@ApiTags('course-levels')
@Controller('course-levels')
export class CourseLevelsController {
  constructor(private readonly levels: CourseLevelsService) {}
  @Get() async list(@Req() request: RequestWithId) {
    return successEnvelope(request, await this.levels.publicList());
  }
}

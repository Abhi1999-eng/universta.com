import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { StudyModesService } from './study-modes.service';
@ApiTags('study-modes')
@Controller('study-modes')
export class StudyModesController {
  constructor(private readonly modes: StudyModesService) {}
  @Get() async list(@Req() request: RequestWithId) {
    return successEnvelope(request, await this.modes.publicList());
  }
}

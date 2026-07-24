import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { ContinentsService } from './continents.service';

@ApiTags('continents')
@Controller('continents')
export class ContinentsController {
  constructor(private readonly continents: ContinentsService) {}

  @Get()
  @ApiOperation({ summary: 'List published active continents' })
  @ApiResponse({ status: 200, description: 'Public continent list' })
  async list(@Req() request: RequestWithId) {
    return successEnvelope(request, await this.continents.publicList());
  }
}

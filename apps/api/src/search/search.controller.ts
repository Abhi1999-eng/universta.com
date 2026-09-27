import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { SearchService } from './search.service';

@ApiTags('search-public')
@Controller('phase1/search')
export class SearchPublicController {
  constructor(private readonly search: SearchService) {}

  @Get()
  async suggest(
    @Req() req: RequestWithId,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return successEnvelope(
      req,
      await this.search.search(q ?? '', limit ? Number(limit) : undefined),
    );
  }
}

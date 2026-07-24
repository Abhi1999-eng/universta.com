import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RequestWithId } from '../common/http.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  CountryListQueryDto,
  DirectoryQueryDto,
  SuggestionsQueryDto,
} from './dto/country.dto';
import { CountriesService } from './countries.service';

@ApiTags('countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get()
  @ApiOperation({ summary: 'List published countries' })
  @ApiResponse({ status: 200, description: 'Public country collection' })
  async list(
    @Req() request: RequestWithId,
    @Query() query: CountryListQueryDto,
  ) {
    const result = await this.countries.publicList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Search published country suggestions' })
  async suggestions(
    @Req() request: RequestWithId,
    @Query() query: SuggestionsQueryDto,
  ) {
    return successEnvelope(request, await this.countries.suggestions(query));
  }

  @Get('directory')
  @ApiOperation({ summary: 'List published countries alphabetically' })
  async directory(
    @Req() request: RequestWithId,
    @Query() query: DirectoryQueryDto,
  ) {
    const result = await this.countries.directory(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a published country by slug' })
  async detail(@Req() request: RequestWithId, @Param('slug') slug: string) {
    return successEnvelope(request, await this.countries.publicDetail(slug));
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  CountryActionDto,
  CountryListQueryDto,
  CreateCountryDto,
  UpdateCountryDto,
} from './dto/country.dto';
import { CountriesService } from './countries.service';

@ApiTags('admin-countries')
@ApiBearerAuth()
@Controller('admin/countries')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get()
  @ApiOperation({ summary: 'List countries for Super Admin management' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: CountryListQueryDto,
  ) {
    const result = await this.countries.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Post()
  @ApiOperation({ summary: 'Create a draft country' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCountryDto,
  ) {
    return successEnvelope(request, await this.countries.create(dto, request));
  }

  @Get(':id/curation-options')
  @ApiOperation({
    summary:
      'List published university and course choices for country curation',
  })
  async curationOptions(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.countries.curationOptions(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a country for editing' })
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return successEnvelope(request, await this.countries.getAdmin(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update core country fields' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCountryDto,
  ) {
    return successEnvelope(
      request,
      await this.countries.update(id, dto, request),
    );
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a country after readiness validation' })
  async publish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CountryActionDto,
  ) {
    return successEnvelope(
      request,
      await this.countries.publish(id, dto, request),
    );
  }

  @Post(':id/unpublish')
  @ApiOperation({ summary: 'Return a country to draft visibility' })
  async unpublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CountryActionDto,
  ) {
    return successEnvelope(
      request,
      await this.countries.unpublish(id, dto, request),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a country' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CountryActionDto,
  ) {
    return successEnvelope(
      request,
      await this.countries.remove(id, dto, request),
    );
  }
}

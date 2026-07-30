import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { LocationsService } from './locations.service';

@ApiTags('locations-public')
@Controller('phase1')
export class LocationsPublicController {
  constructor(private readonly locations: LocationsService) {}

  @Get('countries/:countrySlug/states') async states(
    @Req() req: RequestWithId,
    @Param('countrySlug') countrySlug: string,
  ) {
    return successEnvelope(
      req,
      await this.locations.publicCountryStates(countrySlug),
    );
  }

  @Get('countries/:countrySlug/cities') async cities(
    @Req() req: RequestWithId,
    @Param('countrySlug') countrySlug: string,
    @Query() query: Record<string, string>,
  ) {
    const result = await this.locations.publicCities(countrySlug, query);
    return successEnvelope(req, result.data, {
      ...result.meta,
      country: { name: result.country.name, slug: result.country.slug },
    });
  }

  @Get('countries/:countrySlug/cities/:citySlug') async cityDetail(
    @Req() req: RequestWithId,
    @Param('countrySlug') countrySlug: string,
    @Param('citySlug') citySlug: string,
  ) {
    const city = await this.locations.publicCityDetail(countrySlug, citySlug);
    return successEnvelope(req, city);
  }
}

@ApiTags('locations-admin')
@ApiBearerAuth()
@Controller('admin/states')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class StatesAdminController {
  constructor(private readonly locations: LocationsService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query('countryId') countryId?: string,
  ) {
    return successEnvelope(
      req,
      await this.locations.adminListStates(countryId),
    );
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.locations.adminDetailState(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.locations.createState({
        countryId: body.countryId as string,
        name: body.name as string,
        slug: body.slug as string | undefined,
        status: body.status as string | undefined,
        displayOrder: body.displayOrder as number | undefined,
      }),
    );
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.locations.updateState(id, {
        name: body.name as string | undefined,
        slug: body.slug as string | undefined,
        status: body.status as string | undefined,
        displayOrder: body.displayOrder as number | undefined,
      }),
    );
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.locations.archiveState(id));
  }
}

@ApiTags('locations-admin')
@ApiBearerAuth()
@Controller('admin/cities')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class CitiesAdminController {
  constructor(private readonly locations: LocationsService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return successEnvelope(
      req,
      await this.locations.adminListCities({
        countryId: query.countryId,
        q: query.q,
      }),
    );
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.locations.adminDetailCity(id));
  }

  @Post() async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.locations.createCity(
        {
          countryId: body.countryId as string,
          stateId: body.stateId as string | null | undefined,
          name: body.name as string,
          slug: body.slug as string | undefined,
          shortDescription: body.shortDescription as string | undefined,
          overview: body.overview as string | undefined,
          heroMediaId: body.heroMediaId as string | null | undefined,
          isFeatured: body.isFeatured as boolean | undefined,
          status: body.status as string | undefined,
          displayOrder: body.displayOrder as number | undefined,
        },
        req.user?.sub,
      ),
    );
  }

  @Patch(':id') async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(
      req,
      await this.locations.updateCity(
        id,
        {
          stateId: body.stateId as string | null | undefined,
          name: body.name as string | undefined,
          slug: body.slug as string | undefined,
          shortDescription: body.shortDescription as string | undefined,
          overview: body.overview as string | undefined,
          heroMediaId: body.heroMediaId as string | null | undefined,
          isFeatured: body.isFeatured as boolean | undefined,
          status: body.status as string | undefined,
          displayOrder: body.displayOrder as number | undefined,
        },
        req.user?.sub,
      ),
    );
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.locations.archiveCity(id));
  }

  @Put(':id/seo') async saveSeo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return successEnvelope(req, await this.locations.saveCitySeo(id, body));
  }
}

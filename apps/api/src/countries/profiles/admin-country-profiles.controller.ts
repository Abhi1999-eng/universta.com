import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/access-token.guard';
import { Roles } from '../../auth/auth.decorators';
import { RolesGuard } from '../../auth/roles.guard';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import { successEnvelope } from '../../catalog/catalog.responses';
import { CountryProfilesService } from './country-profiles.service';
import {
  CostProfileDto,
  LanguageProfileDto,
  ProfileVersionDto,
  ReplaceIntakesDto,
  StatisticsProfileDto,
  WorkProfileDto,
} from './profile.dto';

@ApiTags('admin-country-profiles')
@ApiBearerAuth()
@Controller('admin/countries/:countryId/profiles')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCountryProfilesController {
  constructor(private readonly profiles: CountryProfilesService) {}

  @Get()
  async all(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      await this.profiles.adminProfiles(countryId),
    );
  }

  @Get('cost')
  async cost(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      (await this.profiles.adminProfiles(countryId)).cost,
    );
  }
  @Put('cost')
  async putCost(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: CostProfileDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.upsertCost(countryId, dto, request),
    );
  }
  @Delete('cost')
  async removeCost(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: ProfileVersionDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.deleteCost(countryId, dto.expectedUpdatedAt, request),
    );
  }

  @Get('work')
  async work(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      (await this.profiles.adminProfiles(countryId)).work,
    );
  }
  @Put('work')
  async putWork(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: WorkProfileDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.upsertWork(countryId, dto, request),
    );
  }
  @Delete('work')
  async removeWork(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: ProfileVersionDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.deleteWork(countryId, dto.expectedUpdatedAt, request),
    );
  }

  @Get('language')
  async language(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      (await this.profiles.adminProfiles(countryId)).language,
    );
  }
  @Put('language')
  async putLanguage(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: LanguageProfileDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.upsertLanguage(countryId, dto, request),
    );
  }
  @Delete('language')
  async removeLanguage(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: ProfileVersionDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.deleteLanguage(
        countryId,
        dto.expectedUpdatedAt,
        request,
      ),
    );
  }

  @Get('intakes')
  async intakes(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      (await this.profiles.adminProfiles(countryId)).intakes,
    );
  }
  @Put('intakes')
  async putIntakes(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: ReplaceIntakesDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.replaceIntakes(countryId, dto, request),
    );
  }

  @Get('statistics')
  async statistics(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
  ) {
    return successEnvelope(
      request,
      (await this.profiles.adminProfiles(countryId)).statistics,
    );
  }
  @Put('statistics')
  async putStatistics(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: StatisticsProfileDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.upsertStatistics(countryId, dto, request),
    );
  }
  @Delete('statistics')
  async removeStatistics(
    @Req() request: AuthenticatedRequest,
    @Param('countryId') countryId: string,
    @Body() dto: ProfileVersionDto,
  ) {
    return successEnvelope(
      request,
      await this.profiles.deleteStatistics(
        countryId,
        dto.expectedUpdatedAt,
        request,
      ),
    );
  }
}

@ApiTags('admin-intakes')
@ApiBearerAuth()
@Controller('admin/intakes')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminIntakesController {
  constructor(private readonly profiles: CountryProfilesService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return successEnvelope(request, await this.profiles.activeIntakes());
  }
}

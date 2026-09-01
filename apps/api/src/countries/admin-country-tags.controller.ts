import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import { CountryTagsService } from './country-tags.service';

class CreateCountryTagDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(100) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

@Controller('admin/country-tags')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCountryTagsController {
  constructor(private readonly tags: CountryTagsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return successEnvelope(request, await this.tags.list());
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCountryTagDto,
  ) {
    return successEnvelope(request, await this.tags.create(dto));
  }
}

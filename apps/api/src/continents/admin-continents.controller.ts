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
  ContinentListQueryDto,
  CreateContinentDto,
  DeleteContinentDto,
  UpdateContinentDto,
} from './dto/continent.dto';
import { ContinentsService } from './continents.service';

@ApiTags('admin-continents')
@ApiBearerAuth()
@Controller('admin/continents')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminContinentsController {
  constructor(private readonly continents: ContinentsService) {}

  @Get()
  @ApiOperation({ summary: 'List continents for Super Admin management' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ContinentListQueryDto,
  ) {
    const result = await this.continents.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Post()
  @ApiOperation({ summary: 'Create a continent' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateContinentDto,
  ) {
    return successEnvelope(request, await this.continents.create(dto, request));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a continent for editing' })
  async get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return successEnvelope(request, await this.continents.getAdmin(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a continent' })
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContinentDto,
  ) {
    return successEnvelope(
      request,
      await this.continents.update(id, dto, request),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a continent' })
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DeleteContinentDto,
  ) {
    return successEnvelope(
      request,
      await this.continents.remove(id, dto, request),
    );
  }
}

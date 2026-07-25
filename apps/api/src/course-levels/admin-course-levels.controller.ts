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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import {
  CreateMasterDto,
  MasterActionDto,
  MasterListQueryDto,
  UpdateMasterDto,
} from './dto/master.dto';
import { CourseLevelsService } from './course-levels.service';
@ApiBearerAuth()
@ApiTags('admin-course-levels')
@Controller('admin/course-levels')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminCourseLevelsController {
  constructor(private readonly levels: CourseLevelsService) {}
  @Get() async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: MasterListQueryDto,
  ) {
    const result = await this.levels.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }
  @Post() async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMasterDto,
  ) {
    return successEnvelope(request, await this.levels.create(dto, request));
  }
  @Get(':id') async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(request, await this.levels.getAdmin(id));
  }
  @Patch(':id') async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMasterDto,
  ) {
    return successEnvelope(request, await this.levels.update(id, dto, request));
  }
  @Delete(':id') async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MasterActionDto,
  ) {
    return successEnvelope(request, await this.levels.remove(id, dto, request));
  }
}

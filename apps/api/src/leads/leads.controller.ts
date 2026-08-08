import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { successEnvelope } from '../catalog/catalog.responses';
import type { RequestWithId } from '../common/http.types';
import { UpdateLeadConsultantAssignmentDto } from './dto/lead-consultant-assignment.dto';
import {
  CreateCounsellingLeadDto,
  CreateLeadNoteDto,
  LeadListQueryDto,
  UpdateLeadStatusDto,
} from './dto/lead.dto';
import { LeadConsultantAssignmentsService } from './lead-consultant-assignments.service';
import { LeadProtectionService } from './lead-protection.service';
import { LeadsService } from './leads.service';

@ApiTags('public-counselling-leads')
@Controller('public/counselling-leads')
export class PublicLeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly protection: LeadProtectionService,
  ) {}

  @Get('options')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get published counselling form options' })
  async options(@Req() request: RequestWithId) {
    return successEnvelope(request, await this.leads.publicOptions());
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Submit a public counselling request' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: CreateCounsellingLeadDto,
  ) {
    this.protection.assertOrigin(request.get('origin'));
    this.protection.assertBodySize(request.get('content-length'), dto);
    this.protection.assertRateLimit(dto.email, dto.phoneNumber, response);
    return successEnvelope(request, await this.leads.createPublic(dto));
  }
}

@ApiTags('admin-leads')
@ApiBearerAuth()
@Controller('admin/leads')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminLeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly consultantAssignments: LeadConsultantAssignmentsService,
  ) {}

  @Get('options')
  @Header('Cache-Control', 'no-store')
  async options(@Req() request: AuthenticatedRequest) {
    const [options, consultants] = await Promise.all([
      this.leads.adminOptions(),
      this.consultantAssignments.options(),
    ]);
    return successEnvelope(request, { ...options, consultants });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: LeadListQueryDto,
  ) {
    const result = await this.leads.adminList(query);
    return successEnvelope(request, result.data, result.meta);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const lead = await this.leads.adminDetail(id);
    const assignedConsultant = await this.consultantAssignments.current(id);
    return successEnvelope(request, { ...lead, assignedConsultant });
  }

  @Patch(':id/status')
  @Header('Cache-Control', 'no-store')
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return successEnvelope(
      request,
      await this.leads.updateStatus(id, dto, request),
    );
  }

  @Patch(':id/consultant')
  @Header('Cache-Control', 'no-store')
  async updateConsultant(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateLeadConsultantAssignmentDto,
  ) {
    return successEnvelope(
      request,
      await this.consultantAssignments.update(id, dto, request),
    );
  }

  @Post(':id/notes')
  @Header('Cache-Control', 'no-store')
  async createNote(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateLeadNoteDto,
  ) {
    return successEnvelope(
      request,
      await this.leads.createNote(id, dto, request),
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { StudentPhase2Service } from './student-phase2.service';
import {
  AdminApplicationStatusDto,
  AdminConsultantAssignmentDto,
  AdminScholarshipStatusDto,
  AdminSupportStatusDto,
} from './dto/student-phase2.dto';

/** Small operational surface for staff. Student-facing routes never expose
 * these transitions, and this controller remains behind the Admin audience. */
@ApiTags('admin-student-operations')
@ApiBearerAuth()
@Controller('admin/student-operations')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminStudentOperationsController {
  constructor(private readonly portal: StudentPhase2Service) {}

  @Get()
  overview() {
    return this.portal.adminOverview();
  }

  @Patch('applications/:id/status')
  setApplicationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminApplicationStatusDto,
  ) {
    return this.portal.adminSetApplicationStatus(
      req.user!.sub,
      id,
      dto.status,
      dto.message,
      dto.offerMediaId,
    );
  }

  @Patch('scholarship-applications/:id/status')
  setScholarshipStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminScholarshipStatusDto,
  ) {
    return this.portal.adminSetScholarshipStatus(
      req.user!.sub,
      id,
      dto.status,
      dto.message,
    );
  }

  @Patch('students/:profileId/consultant')
  assignConsultant(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: AdminConsultantAssignmentDto,
  ) {
    return this.portal.adminAssignConsultant(profileId, dto.consultantId);
  }

  @Patch('support-tickets/:id/status')
  setSupportStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminSupportStatusDto,
  ) {
    return this.portal.adminSetSupportStatus(req.user!.sub, id, dto.status);
  }
}

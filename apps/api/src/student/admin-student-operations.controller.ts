import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { Roles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { StudentPhase2Service } from './student-phase2.service';
import {
  MediaService,
  STUDENT_DOCUMENT_MIME_TYPES,
} from '../media/media.service';
import {
  AdminApplicationStatusDto,
  AdminConsultantAssignmentDto,
  AdminReferralRewardDto,
  AdminScholarshipStatusDto,
  AdminSupportStatusDto,
  AdminReplyDto,
  ApplicationActionDto,
} from './dto/student-phase2.dto';

/** Small operational surface for staff. Student-facing routes never expose
 * these transitions, and this controller remains behind the Admin audience. */
@ApiTags('admin-student-operations')
@ApiBearerAuth()
@Controller('admin/student-operations')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminStudentOperationsController {
  constructor(
    private readonly portal: StudentPhase2Service,
    private readonly media: MediaService,
  ) {}

  @Get('overview')
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

  @Patch('applications/:id/offer')
  @UseInterceptors(FileInterceptor('file'))
  async uploadOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ApplicationActionDto,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'An offer letter file is required',
        details: null,
      });
    }
    const media = await this.media.upload(
      file,
      { folder: 'student-offers', title: `Offer letter for ${id}` },
      req.user!.sub,
      STUDENT_DOCUMENT_MIME_TYPES,
    );
    return this.portal.adminSetApplicationStatus(
      req.user!.sub,
      id,
      'OFFER_RECEIVED',
      dto.message,
      media.id,
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

  @Patch('conversations/:id/reply')
  replyConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReplyDto,
  ) {
    return this.portal.adminReplyConversation(req.user!.sub, id, dto.body);
  }

  @Patch('referrals/:id/reward-status')
  markReferralPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReferralRewardDto,
  ) {
    return this.portal.adminMarkReferralPaid(id, dto.rewardStatus);
  }

  @Patch('support-tickets/:id/reply')
  replySupportTicket(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminReplyDto,
  ) {
    return this.portal.adminReplySupportTicket(req.user!.sub, id, dto.body);
  }
}

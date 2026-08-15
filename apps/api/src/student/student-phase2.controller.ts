import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { ResponseEnvelope } from '../common/http.types';
import { StudentAccessGuard, studentUserId } from './student-access.guard';
import { StudentPhase2Service } from './student-phase2.service';
import {
  ApplyReferralDto,
  ApplicationActionDto,
  AttachDocumentsDto,
  CreateSupportTicketDto,
  OfferDecisionDto,
  SendMessageDto,
  StartApplicationDto,
  StartScholarshipApplicationDto,
} from './dto/student-phase2.dto';

function envelope<T>(
  request: AuthenticatedRequest,
  data: T,
): ResponseEnvelope<T> {
  return {
    data,
    meta: null,
    error: null,
    requestId: request.requestId ?? 'unknown-request',
    timestamp: new Date().toISOString(),
  };
}

@ApiTags('student-portal')
@ApiBearerAuth()
@Controller('student')
@UseGuards(StudentAccessGuard)
export class StudentPhase2Controller {
  constructor(private readonly portal: StudentPhase2Service) {}

  @Get('saved') listSaved(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.listSaved(studentUserId(req)));
  }
  @Post('saved/universities/:id') saveUniversity(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.saveUniversity(studentUserId(req), id),
    );
  }
  @Delete('saved/universities/:id') @HttpCode(HttpStatus.OK) removeUniversity(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.removeUniversity(studentUserId(req), id),
    );
  }
  @Post('saved/offerings/:id') saveOffering(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(req, this.portal.saveOffering(studentUserId(req), id));
  }
  @Delete('saved/offerings/:id') @HttpCode(HttpStatus.OK) removeOffering(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.removeOffering(studentUserId(req), id),
    );
  }
  @Post('saved/scholarships/:id') saveScholarship(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.saveScholarship(studentUserId(req), id),
    );
  }
  @Delete('saved/scholarships/:id') @HttpCode(HttpStatus.OK) removeScholarship(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.removeScholarship(studentUserId(req), id),
    );
  }

  @Get('applications') listApplications(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.listApplications(studentUserId(req)));
  }
  @Post('applications') @HttpCode(HttpStatus.CREATED) startApplication(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartApplicationDto,
  ) {
    return this.respond(
      req,
      this.portal.startApplication(studentUserId(req), dto),
    );
  }
  @Post('applications/:id/submit') submitApplication(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplicationActionDto,
  ) {
    return this.respond(
      req,
      this.portal.submitApplication(studentUserId(req), id, dto.message),
    );
  }
  @Post('applications/:id/withdraw') withdrawApplication(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplicationActionDto,
  ) {
    return this.respond(
      req,
      this.portal.withdrawApplication(studentUserId(req), id, dto.message),
    );
  }
  @Post('applications/:id/offer-decision') decideOffer(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferDecisionDto,
  ) {
    return this.respond(
      req,
      this.portal.decideOffer(
        studentUserId(req),
        id,
        dto.decision,
        dto.message,
      ),
    );
  }
  @Post('applications/:id/documents') attachApplicationDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentsDto,
  ) {
    return this.respond(
      req,
      this.portal.attachApplicationDocuments(
        studentUserId(req),
        id,
        dto.documentIds,
      ),
    );
  }

  @Get('scholarship-applications') listScholarshipApplications(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.respond(
      req,
      this.portal.listScholarshipApplications(studentUserId(req)),
    );
  }
  @Post('scholarship-applications')
  @HttpCode(HttpStatus.CREATED)
  startScholarshipApplication(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StartScholarshipApplicationDto,
  ) {
    return this.respond(
      req,
      this.portal.startScholarshipApplication(studentUserId(req), dto),
    );
  }
  @Post('scholarship-applications/:id/submit') submitScholarshipApplication(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplicationActionDto,
  ) {
    return this.respond(
      req,
      this.portal.submitScholarshipApplication(
        studentUserId(req),
        id,
        dto.message,
      ),
    );
  }
  @Post('scholarship-applications/:id/documents') attachScholarshipDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentsDto,
  ) {
    return this.respond(
      req,
      this.portal.attachScholarshipDocuments(
        studentUserId(req),
        id,
        dto.documentIds,
      ),
    );
  }

  @Get('messages') conversation(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.conversation(studentUserId(req)));
  }
  @Post('messages') sendMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendMessageDto,
  ) {
    return this.respond(
      req,
      this.portal.sendMessage(studentUserId(req), dto.body),
    );
  }
  @Get('notifications') notifications(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.notifications(studentUserId(req)));
  }
  @Patch('notifications/:id/read') readNotification(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.respond(
      req,
      this.portal.markNotificationRead(studentUserId(req), id),
    );
  }
  @Get('support-tickets') supportTickets(@Req() req: AuthenticatedRequest) {
    return this.respond(
      req,
      this.portal.listSupportTickets(studentUserId(req)),
    );
  }
  @Post('support-tickets') @HttpCode(HttpStatus.CREATED) createSupportTicket(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.respond(
      req,
      this.portal.createSupportTicket(studentUserId(req), dto),
    );
  }
  @Post('support-tickets/:id/messages') replySupportTicket(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.respond(
      req,
      this.portal.replySupportTicket(studentUserId(req), id, dto.body),
    );
  }

  @Get('dashboard') dashboard(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.dashboard(studentUserId(req)));
  }
  @Get('recommendations') recommendations(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.recommendations(studentUserId(req)));
  }
  @Get('deadlines') deadlines(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.deadlines(studentUserId(req)));
  }
  @Get('referrals') referral(@Req() req: AuthenticatedRequest) {
    return this.respond(req, this.portal.referral(studentUserId(req)));
  }
  @Post('referrals/apply') applyReferral(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApplyReferralDto,
  ) {
    return this.respond(
      req,
      this.portal.applyReferral(studentUserId(req), dto.code),
    );
  }

  private async respond<T>(request: AuthenticatedRequest, work: Promise<T>) {
    return envelope(request, await work);
  }
}

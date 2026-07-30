import {
  BadRequestException,
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
import type { RequestWithId } from '../common/http.types';
import { UniversityClaimsService } from './university-claims.service';

function actorId(req: AuthenticatedRequest): string {
  if (!req.user?.sub)
    throw new BadRequestException('Authenticated admin is required');
  return req.user.sub;
}

@ApiTags('university-claims-public')
@Controller('phase1/university-claims')
export class UniversityClaimsPublicController {
  constructor(private readonly claims: UniversityClaimsService) {}

  @Post() async submit(
    @Req() req: RequestWithId,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.claims.submitClaim({
      universitySlug: body.universitySlug as string,
      claimantName: body.claimantName as string | undefined,
      workEmail: body.workEmail as string | undefined,
      jobTitle: body.jobTitle as string | undefined,
      organization: body.organization as string | undefined,
      phoneNumber: body.phoneNumber as string | undefined,
      officialWebsite: body.officialWebsite as string | undefined,
      message: body.message as string | undefined,
      consent: body.consent as boolean | undefined,
      honeypot: body.companyWebsite as string | undefined,
    });
    return successEnvelope(req, result);
  }
}

@ApiTags('university-claims-admin')
@ApiBearerAuth()
@Controller('admin/university-claims')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class UniversityClaimsAdminController {
  constructor(private readonly claims: UniversityClaimsService) {}

  @Get() async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, string>,
  ) {
    return successEnvelope(
      req,
      await this.claims.adminList({ status: query.status, q: query.q }),
    );
  }

  @Get(':id') async detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.claims.adminDetail(id));
  }

  @Patch(':id/status') async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: string; reason?: string },
  ) {
    return successEnvelope(
      req,
      await this.claims.updateStatus(
        id,
        body.status ?? '',
        body.reason,
        actorId(req),
      ),
    );
  }

  @Post(':id/notes') async addNote(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return successEnvelope(
      req,
      await this.claims.addNote(id, body.note ?? '', actorId(req)),
    );
  }

  @Delete(':id') async archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return successEnvelope(req, await this.claims.archive(id));
  }
}

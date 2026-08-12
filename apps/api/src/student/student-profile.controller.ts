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
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ResponseEnvelope } from '../common/http.types';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { StudentAccessGuard, studentUserId } from './student-access.guard';
import { StudentProfileService } from './student-profile.service';
import {
  StudentAcademicDto,
  StudentEnglishTestDto,
  StudentPassportDto,
  StudentWorkDto,
  UpdateStudentAcademicDto,
  UpdateStudentEnglishTestDto,
  UpdateStudentProfileDto,
  UpdateStudentWorkDto,
} from './dto/student-profile.dto';

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

/**
 * The student's own record.
 *
 * Every route resolves the profile from the verified token. No path, query or
 * body parameter names a user or a profile, so there is nothing for one
 * student to change in order to reach another's data.
 */
@ApiTags('student-profile')
@ApiBearerAuth()
@Controller('student')
@UseGuards(StudentAccessGuard)
export class StudentProfileController {
  constructor(private readonly profiles: StudentProfileService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'The signed-in student profile',
    description:
      'Passport is not included: it has its own endpoint so sensitive data ' +
      'is not carried by a response the portal fetches on every page.',
  })
  async getProfile(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.getProfile(studentUserId(request)),
    );
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update personal details and study preferences' })
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStudentProfileDto,
  ) {
    return envelope(
      request,
      await this.profiles.updateProfile(studentUserId(request), dto),
    );
  }

  @Get('profile/completion')
  @ApiOperation({
    summary: 'How complete the profile is, and the single next step',
  })
  async completion(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.completion(studentUserId(request)),
    );
  }

  // -- academics ----------------------------------------------------------

  @Get('academics')
  async listAcademics(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.listAcademics(studentUserId(request)),
    );
  }

  @Post('academics')
  @HttpCode(HttpStatus.CREATED)
  async createAcademic(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentAcademicDto,
  ) {
    return envelope(
      request,
      await this.profiles.createAcademic(studentUserId(request), { ...dto }),
    );
  }

  @Patch('academics/:id')
  async updateAcademic(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentAcademicDto,
  ) {
    return envelope(
      request,
      await this.profiles.updateAcademic(studentUserId(request), id, {
        ...dto,
      }),
    );
  }

  @Delete('academics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAcademic(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.profiles.deleteAcademic(studentUserId(request), id);
  }

  // -- work ---------------------------------------------------------------

  @Get('work-experience')
  async listWork(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.listWork(studentUserId(request)),
    );
  }

  @Post('work-experience')
  @HttpCode(HttpStatus.CREATED)
  async createWork(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentWorkDto,
  ) {
    return envelope(
      request,
      await this.profiles.createWork(studentUserId(request), { ...dto }),
    );
  }

  @Patch('work-experience/:id')
  async updateWork(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentWorkDto,
  ) {
    return envelope(
      request,
      await this.profiles.updateWork(studentUserId(request), id, { ...dto }),
    );
  }

  @Delete('work-experience/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWork(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.profiles.deleteWork(studentUserId(request), id);
  }

  // -- english tests ------------------------------------------------------

  @Get('english-tests')
  async listEnglishTests(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.listEnglishTests(studentUserId(request)),
    );
  }

  @Post('english-tests')
  @HttpCode(HttpStatus.CREATED)
  async createEnglishTest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentEnglishTestDto,
  ) {
    return envelope(
      request,
      await this.profiles.createEnglishTest(studentUserId(request), { ...dto }),
    );
  }

  @Patch('english-tests/:id')
  async updateEnglishTest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentEnglishTestDto,
  ) {
    return envelope(
      request,
      await this.profiles.updateEnglishTest(studentUserId(request), id, {
        ...dto,
      }),
    );
  }

  @Delete('english-tests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEnglishTest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.profiles.deleteEnglishTest(studentUserId(request), id);
  }

  // -- passport -----------------------------------------------------------

  @Get('passport')
  @ApiOperation({
    summary: 'The student’s own passport details',
    description:
      'Owner-only. Never included in any listing or profile payload.',
  })
  async getPassport(@Req() request: AuthenticatedRequest) {
    return envelope(
      request,
      await this.profiles.getPassport(studentUserId(request)),
    );
  }

  @Put('passport')
  async savePassport(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentPassportDto,
  ) {
    return envelope(
      request,
      await this.profiles.savePassport(studentUserId(request), { ...dto }),
    );
  }

  @Delete('passport')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePassport(@Req() request: AuthenticatedRequest) {
    await this.profiles.deletePassport(studentUserId(request));
  }
}

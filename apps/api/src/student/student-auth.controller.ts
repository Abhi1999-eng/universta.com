import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequestContextService } from '../common/request-context.service';
import type { ResponseEnvelope } from '../common/http.types';
import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  type AuthRequestMetadata,
  type AuthResponseData,
  type AuthenticatedRequest,
} from '../auth/auth.types';
import { StudentAuthService } from './student-auth.service';
import { StudentAccessGuard, studentUserId } from './student-access.guard';
import {
  StudentEmailDto,
  StudentLoginDto,
  StudentRegisterDto,
  StudentResetPasswordDto,
  StudentVerifyEmailDto,
} from './dto/student-auth.dto';

/** Its own cookie, so a student session and an admin session can coexist in
 * one browser instead of overwriting each other. */
const STUDENT_REFRESH_COOKIE = 'universta_student_refresh';
const COOKIE_PATH = '/';

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

function metadata(
  request: AuthenticatedRequest,
  context: RequestContextService,
): AuthRequestMetadata {
  return {
    requestId: request.requestId ?? context.getRequestId() ?? 'unknown-request',
    ipAddress: request.ip?.slice(0, 45) ?? null,
    userAgent: request.get('user-agent')?.slice(0, 1000) ?? null,
  };
}

function readRefreshCookie(request: AuthenticatedRequest): string | undefined {
  const cookies: unknown = request.cookies;
  if (!cookies || typeof cookies !== 'object') return undefined;
  const value = (cookies as Record<string, unknown>)[STUDENT_REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

/** The refresh token goes to the browser as an HttpOnly cookie and never into
 * a response body, so page JavaScript cannot read or exfiltrate it. */
function withoutRefreshToken(
  result: AuthResponseData & { refreshToken: string },
): AuthResponseData {
  return {
    accessToken: result.accessToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
    user: result.user,
  };
}

@ApiTags('student-auth')
@Controller('student/auth')
export class StudentAuthController {
  constructor(
    private readonly students: StudentAuthService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly context: RequestContextService,
  ) {}

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(STUDENT_REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: COOKIE_PATH,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(STUDENT_REFRESH_COOKIE, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: COOKIE_PATH,
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a student account' })
  async register(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentRegisterDto,
  ) {
    const result = await this.students.register(
      dto,
      metadata(request, this.context),
    );
    return envelope(request, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in to the student portal' })
  async login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: StudentLoginDto,
  ) {
    const result = await this.students.login(
      dto,
      metadata(request, this.context),
    );
    this.setRefreshCookie(response, result.refreshToken);
    return envelope(request, withoutRefreshToken(result));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the student session' })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.students.refresh(
      readRefreshCookie(request),
      metadata(request, this.context),
    );
    this.setRefreshCookie(response, result.refreshToken);
    return envelope(request, withoutRefreshToken(result));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the student session' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.students.logout(
      readRefreshCookie(request),
      metadata(request, this.context),
    );
    this.clearRefreshCookie(response);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address' })
  async verifyEmail(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentVerifyEmailDto,
  ) {
    await this.students.verifyEmail(dto.token);
    return envelope(request, { verified: true });
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Send a fresh verification link',
    description:
      'Always accepted, whether or not the address has an account, so the ' +
      'endpoint cannot be used to discover who is registered.',
  })
  async resendVerification(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentEmailDto,
  ) {
    await this.students.resendVerification(
      dto.email,
      metadata(request, this.context),
    );
    return envelope(request, { requested: true });
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start a password reset',
    description: 'Always accepted, for the same reason as resend-verification.',
  })
  async forgotPassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: StudentEmailDto,
  ) {
    await this.students.forgotPassword(
      dto.email,
      metadata(request, this.context),
    );
    return envelope(request, { requested: true });
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a new password from a reset link' })
  async resetPassword(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: StudentResetPasswordDto,
  ) {
    await this.students.resetPassword(dto.token, dto.password);
    // Every session was revoked, including this browser's.
    this.clearRefreshCookie(response);
    return envelope(request, { reset: true });
  }

  @Get('me')
  @UseGuards(StudentAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The signed-in student' })
  async me(@Req() request: AuthenticatedRequest) {
    return envelope(request, await this.students.me(studentUserId(request)));
  }
}

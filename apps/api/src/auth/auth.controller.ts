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
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequestContextService } from '../common/request-context.service';
import type { ResponseEnvelope } from '../common/http.types';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { AccessTokenGuard } from './access-token.guard';
import { AuthService, isSupersededRefreshToken } from './auth.service';
import { CurrentUser } from './auth.decorators';
import {
  type AccessTokenPayload,
  type AuthRequestMetadata,
  type AuthenticatedRequest,
  type AuthenticatedAdmin,
  type AuthResponseData,
} from './auth.types';
import { LoginDto } from './dto/login.dto';

// The Admin server must receive this HttpOnly cookie before it renders a
// protected route. API auth endpoints still require it independently.
const REFRESH_COOKIE_PATH = '/';
const LEGACY_REFRESH_COOKIE_PATH = '/api/v1/admin/auth';

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

function refreshCookie(
  request: AuthenticatedRequest,
  cookieName: string,
): string | undefined {
  const cookies: unknown = request.cookies;
  if (!cookies || typeof cookies !== 'object') {
    return undefined;
  }
  const value = (cookies as Record<string, unknown>)[cookieName];
  return typeof value === 'string' ? value : undefined;
}

function safeAuthResponse(
  result: AuthResponseData & { refreshToken: string },
): AuthResponseData {
  return {
    accessToken: result.accessToken,
    tokenType: result.tokenType,
    expiresIn: result.expiresIn,
    user: result.user,
  };
}

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly context: RequestContextService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in a Super Admin' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Access token returned; refresh token is set in an HttpOnly cookie.',
    schema: {
      example: {
        data: {
          accessToken: '<access-token>',
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            id: '<uuid>',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: null,
            roles: ['SUPER_ADMIN'],
          },
        },
        meta: null,
        error: null,
        requestId: '<request-id>',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Generic invalid credentials response.',
    schema: {
      example: {
        data: null,
        meta: null,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: null,
        },
        requestId: '<request-id>',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Account temporarily locked.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseEnvelope<Omit<AuthResponseData, 'refreshToken'>>> {
    const result = await this.auth.login(dto, metadata(request, this.context));
    this.setRefreshCookie(response, result.refreshToken);
    return envelope(request, safeAuthResponse(result));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('admin-refresh-cookie')
  @ApiOperation({ summary: 'Rotate the Super Admin refresh token cookie' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New access token and rotated refresh cookie.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, invalid, expired, or replayed refresh token.',
  })
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseEnvelope<Omit<AuthResponseData, 'refreshToken'>>> {
    try {
      const result = await this.auth.refresh(
        refreshCookie(request, this.runtimeConfig.authRefreshCookieName),
        metadata(request, this.context),
      );
      this.setRefreshCookie(response, result.refreshToken);
      return envelope(request, safeAuthResponse(result));
    } catch (error) {
      // A refresh that merely lost a rotation race must not clear the cookie:
      // the winning rotation has already issued a good one, and clearing here
      // would log the admin out of a session that is perfectly alive.
      if (!isSupersededRefreshToken(error)) {
        this.clearRefreshCookie(response);
      }
      throw error;
    }
  }

  @Post('session/validate')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('admin-refresh-cookie')
  @ApiOperation({
    summary: 'Validate an active Admin refresh session without rotation',
  })
  async validateSession(
    @Req() request: AuthenticatedRequest,
  ): Promise<ResponseEnvelope<{ user: AuthenticatedAdmin }>> {
    const user = await this.auth.validateRefreshSession(
      refreshCookie(request, this.runtimeConfig.authRefreshCookieName),
    );
    return envelope(request, { user });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('admin-refresh-cookie')
  @ApiOperation({
    summary: 'Revoke the current refresh token and clear its cookie',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Logout is idempotent.' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResponseEnvelope<{ loggedOut: true }>> {
    await this.auth.logout(
      refreshCookie(request, this.runtimeConfig.authRefreshCookieName),
      metadata(request, this.context),
    );
    this.clearRefreshCookie(response);
    return envelope(request, { loggedOut: true });
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current active Super Admin' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user and active roles.',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description:
      'Bearer token is missing, invalid, expired, or no longer active.',
  })
  async me(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() currentUser: AccessTokenPayload,
  ): Promise<ResponseEnvelope<{ user: AuthenticatedAdmin }>> {
    const user = await this.auth.getCurrentAdmin(currentUser.sub);
    return envelope(request, { user });
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(this.runtimeConfig.authRefreshCookieName, token, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshTtlSeconds() * 1000,
    });
    // Remove the former narrow-path cookie during the one-time path upgrade.
    response.clearCookie(this.runtimeConfig.authRefreshCookieName, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: LEGACY_REFRESH_COOKIE_PATH,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.runtimeConfig.authRefreshCookieName, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
    response.clearCookie(this.runtimeConfig.authRefreshCookieName, {
      httpOnly: true,
      secure: ['production', 'staging'].includes(this.runtimeConfig.nodeEnv),
      sameSite: 'lax',
      path: LEGACY_REFRESH_COOKIE_PATH,
    });
  }

  private refreshTtlSeconds(): number {
    const ttl = this.runtimeConfig.jwtRefreshTtl;
    const amount = Number(ttl.slice(0, -1));
    const unit = ttl.at(-1);
    return (
      amount *
      (unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400)
    );
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RuntimeConfigService } from '../config/runtime-config.service';
import {
  ACCESS_TOKEN_TYPE,
  AUTH_ISSUER,
  STUDENT_AUTH_AUDIENCE,
  STUDENT_ROLE,
  type AccessTokenPayload,
  type AuthenticatedRequest,
} from '../auth/auth.types';

function invalidAccessToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid access token',
    details: null,
  });
}

/**
 * Admits a student session and nothing else.
 *
 * The audience check is the real boundary: an admin access token names
 * `universta-admin-api`, so `verifyAsync` rejects it here before any role is
 * read — and the admin guard rejects a student token the same way. The role
 * check below is a second, cheaper line of defence for the case where a token
 * is somehow minted with the right audience and the wrong claims.
 */
@Injectable()
export class StudentAccessGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw invalidAccessToken();
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw invalidAccessToken();
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.runtimeConfig.jwtAccessSecret,
        issuer: AUTH_ISSUER,
        audience: STUDENT_AUTH_AUDIENCE,
      });
      if (
        payload.type !== ACCESS_TOKEN_TYPE ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.jti !== 'string' ||
        !Array.isArray(payload.roles) ||
        !payload.roles.includes(STUDENT_ROLE)
      ) {
        throw invalidAccessToken();
      }
      request.user = payload;
      return true;
    } catch {
      throw invalidAccessToken();
    }
  }
}

/** The authenticated student's id, taken from the verified token and never
 * from the request body or query — that is what stops one student naming
 * another in a payload. */
export function studentUserId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id) {
    throw invalidAccessToken();
  }
  return id;
}

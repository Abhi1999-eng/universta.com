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
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  type AccessTokenPayload,
  type AuthenticatedRequest,
} from './auth.types';

function invalidAccessToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Invalid access token',
    details: null,
  });
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
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
        audience: AUTH_AUDIENCE,
      });
      if (
        payload.type !== ACCESS_TOKEN_TYPE ||
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.jti !== 'string' ||
        !Array.isArray(payload.roles) ||
        !payload.roles.every((role) => typeof role === 'string')
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

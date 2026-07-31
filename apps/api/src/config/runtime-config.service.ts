import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from './configuration';
import { parseCorsOrigins, type ValidatedEnvironment } from './environment';

@Injectable()
export class RuntimeConfigService {
  constructor(
    private readonly configService: ConfigService<ValidatedEnvironment, true>,
  ) {}

  get value(): AppConfiguration {
    const origins = this.configService.getOrThrow<unknown>('CORS_ORIGINS');
    const corsOrigins =
      Array.isArray(origins) &&
      origins.every((origin): origin is string => typeof origin === 'string')
        ? origins
        : parseCorsOrigins(origins);
    return {
      nodeEnv: this.configService.getOrThrow('NODE_ENV'),
      port: this.configService.getOrThrow('PORT'),
      databaseUrl: this.configService.getOrThrow('DATABASE_URL'),
      corsOrigins,
      swaggerEnabled: this.configService.getOrThrow('SWAGGER_ENABLED'),
      jwtAccessSecret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
      jwtRefreshSecret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      jwtAccessTtl: this.configService.getOrThrow('JWT_ACCESS_TTL'),
      jwtRefreshTtl: this.configService.getOrThrow('JWT_REFRESH_TTL'),
      authRefreshCookieName: this.configService.getOrThrow(
        'AUTH_REFRESH_COOKIE_NAME',
      ),
      authMaxFailedAttempts: this.configService.getOrThrow(
        'AUTH_MAX_FAILED_ATTEMPTS',
      ),
      authLockMinutes: this.configService.getOrThrow('AUTH_LOCK_MINUTES'),
    };
  }

  get nodeEnv(): AppConfiguration['nodeEnv'] {
    return this.value.nodeEnv;
  }

  get port(): number {
    return this.value.port;
  }

  get databaseUrl(): string {
    return this.value.databaseUrl;
  }

  get corsOrigins(): string[] {
    return this.value.corsOrigins;
  }

  /** Public web origin used for links minted by the API. The API sees the
   * runtime deployment origins; unlike NEXT_PUBLIC_* values this is not frozen
   * into an Admin bundle during CI. */
  get webOrigin(): string {
    const parsed = this.corsOrigins.flatMap((origin) => {
      try {
        return [new URL(origin)];
      } catch {
        return [];
      }
    });
    const web = parsed.find(
      (url) =>
        !url.hostname.toLowerCase().startsWith('admin.') && url.port !== '3001',
    );
    if (!web) {
      throw new Error('CORS_ORIGINS must include the public web origin');
    }
    return web.origin;
  }

  get swaggerEnabled(): boolean {
    return this.value.swaggerEnabled;
  }

  get jwtAccessSecret(): string {
    return this.value.jwtAccessSecret;
  }

  get jwtRefreshSecret(): string {
    return this.value.jwtRefreshSecret;
  }

  get jwtAccessTtl(): string {
    return this.value.jwtAccessTtl;
  }

  get jwtRefreshTtl(): string {
    return this.value.jwtRefreshTtl;
  }

  get authRefreshCookieName(): string {
    return this.value.authRefreshCookieName;
  }

  get authMaxFailedAttempts(): number {
    return this.value.authMaxFailedAttempts;
  }

  get authLockMinutes(): number {
    return this.value.authLockMinutes;
  }
}

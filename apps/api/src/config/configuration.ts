import {
  validateEnvironment,
  type EnvironmentName,
  type ValidatedEnvironment,
} from './environment';

export interface AppConfiguration {
  nodeEnv: EnvironmentName;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  authRefreshCookieName: string;
  authMaxFailedAttempts: number;
  authLockMinutes: number;
  databaseConnectTimeoutMs: number;
  databaseAcquireTimeoutMs: number;
}

export const configuration = (): { app: AppConfiguration } => {
  const environment: ValidatedEnvironment = validateEnvironment(process.env);

  return {
    app: {
      nodeEnv: environment.NODE_ENV,
      port: environment.PORT,
      databaseUrl: environment.DATABASE_URL,
      corsOrigins: environment.CORS_ORIGINS,
      swaggerEnabled: environment.SWAGGER_ENABLED,
      jwtAccessSecret: environment.JWT_ACCESS_SECRET,
      jwtRefreshSecret: environment.JWT_REFRESH_SECRET,
      jwtAccessTtl: environment.JWT_ACCESS_TTL,
      jwtRefreshTtl: environment.JWT_REFRESH_TTL,
      authRefreshCookieName: environment.AUTH_REFRESH_COOKIE_NAME,
      authMaxFailedAttempts: environment.AUTH_MAX_FAILED_ATTEMPTS,
      authLockMinutes: environment.AUTH_LOCK_MINUTES,
      databaseConnectTimeoutMs: environment.DATABASE_CONNECT_TIMEOUT_MS,
      databaseAcquireTimeoutMs: environment.DATABASE_ACQUIRE_TIMEOUT_MS,
    },
  };
};

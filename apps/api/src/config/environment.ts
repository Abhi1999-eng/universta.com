export const ENVIRONMENT_NAMES = [
  'development',
  'test',
  'staging',
  'production',
] as const;

export type EnvironmentName = (typeof ENVIRONMENT_NAMES)[number];

export interface ValidatedEnvironment {
  NODE_ENV: EnvironmentName;
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string[];
  SWAGGER_ENABLED: boolean;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  AUTH_REFRESH_COOKIE_NAME: string;
  AUTH_MAX_FAILED_ATTEMPTS: number;
  AUTH_LOCK_MINUTES: number;
  DATABASE_CONNECT_TIMEOUT_MS: number;
  DATABASE_ACQUIRE_TIMEOUT_MS: number;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  throw new Error('Invalid configuration variable: SWAGGER_ENABLED');
}

export function parseCorsOrigins(value: unknown): string[] {
  if (typeof value !== 'string') {
    throw new Error('Invalid configuration variable: CORS_ORIGINS');
  }

  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const normalizedOrigins = origins.map((origin) => {
    if (origin === '*') {
      throw new Error('Invalid configuration variable: CORS_ORIGINS');
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('Invalid configuration variable: CORS_ORIGINS');
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error('Invalid configuration variable: CORS_ORIGINS');
    }

    return parsed.origin;
  });

  const uniqueOrigins = [...new Set(normalizedOrigins)];
  if (uniqueOrigins.length === 0) {
    throw new Error('Invalid configuration variable: CORS_ORIGINS');
  }

  return uniqueOrigins;
}

/** Environments in which the API issues `Secure` session cookies. */
const SECURE_COOKIE_ENVIRONMENTS: readonly EnvironmentName[] = [
  'production',
  'staging',
];

export function requiresSecureCookies(nodeEnv: EnvironmentName): boolean {
  return SECURE_COOKIE_ENVIRONMENTS.includes(nodeEnv);
}

/** Refuses to start a Secure-cookie environment that is serving plain HTTP.
 *
 * The two settings are silently incompatible, which is the dangerous part: a
 * browser will not send a `Secure` cookie over http://, so the API comes up
 * healthy, login appears to succeed, and every subsequent request arrives
 * unauthenticated. That reads as a broken session, not as a misconfiguration,
 * and it is a miserable thing to debug in a deployed environment. Failing at
 * startup with the reason named is far cheaper.
 *
 * Development and test are untouched: they do not set Secure, so http://
 * origins are correct there. */
export function assertOriginsMatchCookiePolicy(
  nodeEnv: EnvironmentName,
  corsOrigins: readonly string[],
): void {
  if (!requiresSecureCookies(nodeEnv)) return;

  const insecure = corsOrigins.filter(
    (origin) => new URL(origin).protocol !== 'https:',
  );
  if (insecure.length === 0) return;

  throw new Error(
    `Invalid configuration: NODE_ENV=${nodeEnv} issues Secure session cookies, ` +
      'which browsers refuse to send over http://, so authentication would fail ' +
      'for every request. Configure HTTPS origins in CORS_ORIGINS. Insecure ' +
      `origins: ${insecure.join(', ')}`,
  );
}

function requiredString(env: Record<string, unknown>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required configuration variable: ${name}`);
  }
  return value.trim();
}

function requiredSecret(env: Record<string, unknown>, name: string): string {
  const value = requiredString(env, name);
  if (value.length < 32) {
    throw new Error(`Invalid configuration variable: ${name}`);
  }
  return value;
}

export function parseTtl(
  value: unknown,
  name: string,
  fallback: string,
): string {
  const normalized = value === undefined || value === '' ? fallback : value;
  if (typeof normalized !== 'string' || !/^\d+(s|m|h|d)$/.test(normalized)) {
    throw new Error(`Invalid configuration variable: ${name}`);
  }
  const amount = Number(normalized.slice(0, -1));
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error(`Invalid configuration variable: ${name}`);
  }
  return normalized;
}

export function ttlToSeconds(ttl: string): number {
  const amount = Number(ttl.slice(0, -1));
  const unit = ttl.at(-1);
  const multiplier =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * multiplier;
}

function parsePositiveInteger(
  value: unknown,
  name: string,
  fallback: number,
): number {
  const normalized =
    value === undefined || value === '' ? String(fallback) : value;
  if (typeof normalized !== 'string' && typeof normalized !== 'number') {
    throw new Error(`Invalid configuration variable: ${name}`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid configuration variable: ${name}`);
  }
  return parsed;
}

function parsePort(value: unknown, nodeEnv: EnvironmentName): number {
  if (
    (value === undefined || value === '') &&
    (nodeEnv === 'development' || nodeEnv === 'test')
  ) {
    return 4000;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Invalid configuration variable: PORT');
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid configuration variable: PORT');
  }

  return port;
}

function validateDatabaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (
      !['mysql:', 'mariadb:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.pathname === '/'
    ) {
      throw new Error('invalid');
    }
  } catch {
    throw new Error('Invalid configuration variable: DATABASE_URL');
  }

  return value;
}

export function validateEnvironment(
  env: Record<string, unknown>,
): ValidatedEnvironment {
  const nodeEnvValue = requiredString(env, 'NODE_ENV');
  if (!ENVIRONMENT_NAMES.includes(nodeEnvValue as EnvironmentName)) {
    throw new Error('Invalid configuration variable: NODE_ENV');
  }

  const nodeEnv = nodeEnvValue as EnvironmentName;
  const databaseUrl = validateDatabaseUrl(requiredString(env, 'DATABASE_URL'));
  const corsOrigins = parseCorsOrigins(requiredString(env, 'CORS_ORIGINS'));
  const accessSecret = requiredSecret(env, 'JWT_ACCESS_SECRET');
  const refreshSecret = requiredSecret(env, 'JWT_REFRESH_SECRET');
  if (accessSecret === refreshSecret) {
    throw new Error('Invalid configuration variable: JWT_REFRESH_SECRET');
  }
  assertOriginsMatchCookiePolicy(nodeEnv, corsOrigins);

  return {
    NODE_ENV: nodeEnv,
    PORT: parsePort(env.PORT, nodeEnv),
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    SWAGGER_ENABLED: parseBoolean(
      env.SWAGGER_ENABLED,
      nodeEnv === 'development',
    ),
    JWT_ACCESS_SECRET: accessSecret,
    JWT_REFRESH_SECRET: refreshSecret,
    JWT_ACCESS_TTL: parseTtl(env.JWT_ACCESS_TTL, 'JWT_ACCESS_TTL', '15m'),
    JWT_REFRESH_TTL: parseTtl(env.JWT_REFRESH_TTL, 'JWT_REFRESH_TTL', '30d'),
    AUTH_REFRESH_COOKIE_NAME:
      typeof env.AUTH_REFRESH_COOKIE_NAME === 'string' &&
      env.AUTH_REFRESH_COOKIE_NAME.trim() !== ''
        ? env.AUTH_REFRESH_COOKIE_NAME.trim()
        : 'universta_admin_refresh',
    AUTH_MAX_FAILED_ATTEMPTS: parsePositiveInteger(
      env.AUTH_MAX_FAILED_ATTEMPTS,
      'AUTH_MAX_FAILED_ATTEMPTS',
      5,
    ),
    AUTH_LOCK_MINUTES: parsePositiveInteger(
      env.AUTH_LOCK_MINUTES,
      'AUTH_LOCK_MINUTES',
      15,
    ),
    /* The driver's own defaults are 1s to open a socket but 10s to obtain a
     * pooled connection, so with the database unreachable every request sat
     * for ~11s before failing. The Admin BFF gives the API 5s, so it timed
     * out first and reported AUTH_SERVICE_UNAVAILABLE -- the proxy's verdict,
     * not the API's. Failing inside the caller's budget lets the real reason
     * reach the console. */
    DATABASE_CONNECT_TIMEOUT_MS: parsePositiveInteger(
      env.DATABASE_CONNECT_TIMEOUT_MS,
      'DATABASE_CONNECT_TIMEOUT_MS',
      1_000,
    ),
    DATABASE_ACQUIRE_TIMEOUT_MS: parsePositiveInteger(
      env.DATABASE_ACQUIRE_TIMEOUT_MS,
      'DATABASE_ACQUIRE_TIMEOUT_MS',
      2_500,
    ),
  };
}

export function isSafeRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

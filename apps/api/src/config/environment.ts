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

function requiredString(env: Record<string, unknown>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required configuration variable: ${name}`);
  }
  return value.trim();
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

  return {
    NODE_ENV: nodeEnv,
    PORT: parsePort(env.PORT, nodeEnv),
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    SWAGGER_ENABLED: parseBoolean(
      env.SWAGGER_ENABLED,
      nodeEnv === 'development',
    ),
  };
}

export function isSafeRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

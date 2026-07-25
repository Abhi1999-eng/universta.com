const FORBIDDEN_ENVIRONMENTS = new Set([
  'production',
  'prod',
  'staging',
  'stage',
]);
const ALLOWED_ENVIRONMENTS = new Set([
  'development',
  'dev',
  'local',
  'test',
  'ci',
]);

export function assertDemoCatalogSeedAllowed(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (environment.SEED_DEMO_CATALOG !== 'true') {
    throw new Error(
      'Demo catalog seeding is disabled. Set SEED_DEMO_CATALOG=true explicitly.',
    );
  }

  const environments = [
    environment.APP_ENV,
    environment.DEPLOYMENT_ENV,
    environment.ENVIRONMENT,
    environment.NODE_ENV,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());

  if (environments.some((value) => FORBIDDEN_ENVIRONMENTS.has(value))) {
    throw new Error(
      'Demo catalog seeding is forbidden in staging and production environments.',
    );
  }

  const isCi = environment.CI === 'true';
  const isAllowedEnvironment = environments.some((value) =>
    ALLOWED_ENVIRONMENTS.has(value),
  );
  if (!isCi && !isAllowedEnvironment) {
    throw new Error(
      'Demo catalog seeding is allowed only in local, development, test, or CI environments.',
    );
  }
}

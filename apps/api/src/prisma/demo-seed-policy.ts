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

/**
 * The demo host deliberately runs the application with NODE_ENV=production.
 * That must keep rejecting the ordinary local demo seed. A separately
 * invoked, marker-scoped QA operation is the sole exception: it is available
 * only on the environment explicitly classified as the AWS demo host and
 * still requires both opt-in switches. This lets automated acceptance use
 * representative fictional data without making a normal deployment reseed
 * catalogue records.
 */
function isExplicitAwsDemoQaDataset(environment: NodeJS.ProcessEnv): boolean {
  return (
    environment.QA_E2E_DATASET === 'true' &&
    environment.QA_DATASET_MARKER === 'FORGE_E2E_2026' &&
    environment.DEPLOYMENT_ENV?.trim().toLowerCase() === 'demo'
  );
}

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

  if (
    environments.some((value) => FORBIDDEN_ENVIRONMENTS.has(value)) &&
    !isExplicitAwsDemoQaDataset(environment)
  ) {
    throw new Error(
      'Demo catalog seeding is forbidden in staging and production environments.',
    );
  }

  const isCi = environment.CI === 'true';
  const isAllowedEnvironment = environments.some((value) =>
    ALLOWED_ENVIRONMENTS.has(value),
  );
  if (
    !isCi &&
    !isAllowedEnvironment &&
    !isExplicitAwsDemoQaDataset(environment)
  ) {
    throw new Error(
      'Demo catalog seeding is allowed only in local, development, test, or CI environments.',
    );
  }
}

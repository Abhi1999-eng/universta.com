import { assertDemoCatalogSeedAllowed } from './demo-seed-policy';

describe('demo catalog seed policy', () => {
  it('requires an explicit demo catalog flag', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({ NODE_ENV: 'development' }),
    ).toThrow('Set SEED_DEMO_CATALOG=true explicitly');
  });

  it.each(['production', 'prod', 'staging', 'stage'])(
    'rejects the %s environment before seeding',
    (NODE_ENV) => {
      expect(() =>
        assertDemoCatalogSeedAllowed({
          NODE_ENV,
          SEED_DEMO_CATALOG: 'true',
        }),
      ).toThrow('forbidden in staging and production');
    },
  );

  it.each(['development', 'dev', 'local', 'test', 'ci'])(
    'allows explicitly enabled %s environments',
    (NODE_ENV) => {
      expect(() =>
        assertDemoCatalogSeedAllowed({
          NODE_ENV,
          SEED_DEMO_CATALOG: 'true',
        }),
      ).not.toThrow();
    },
  );

  it('allows an explicitly enabled CI environment', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({
        CI: 'true',
        SEED_DEMO_CATALOG: 'true',
      }),
    ).not.toThrow();
  });

  it('rejects ambiguous environments outside CI', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({
        NODE_ENV: 'preview',
        SEED_DEMO_CATALOG: 'true',
      }),
    ).toThrow('allowed only in local, development, test, or CI');
  });

  it('keeps production forbidden even when CI is true', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({
        CI: 'true',
        NODE_ENV: 'production',
        SEED_DEMO_CATALOG: 'true',
      }),
    ).toThrow('forbidden in staging and production');
  });

  it('permits only the explicit marker-scoped AWS demo QA operation', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        DEPLOYMENT_ENV: 'demo',
        SEED_DEMO_CATALOG: 'true',
        QA_E2E_DATASET: 'true',
        QA_DATASET_MARKER: 'FORGE_E2E_2026',
      }),
    ).not.toThrow();
  });

  it('does not permit a production demo host without every QA guard', () => {
    expect(() =>
      assertDemoCatalogSeedAllowed({
        NODE_ENV: 'production',
        DEPLOYMENT_ENV: 'demo',
        SEED_DEMO_CATALOG: 'true',
        QA_E2E_DATASET: 'true',
      }),
    ).toThrow('forbidden in staging and production');
  });
});

import {
  databaseAdapterConfig,
  databaseConnectionFromUrl,
} from './prisma.service';

/**
 * Two fixes share this adapter config and neither may quietly disappear.
 *
 * `allowPublicKeyRetrieval` (#123) is what lets the MariaDB driver complete a
 * caching_sha2_password handshake against the deployed MySQL instance; without
 * it the pool stays empty and every request fails. The bounded timeouts are
 * what stop an unreachable database from holding each request for ~11s -- long
 * past the Admin BFF's 5s upstream budget, which is why a database problem
 * surfaced as the proxy's AUTH_SERVICE_UNAVAILABLE instead of the API's own
 * answer.
 */
describe('database adapter configuration', () => {
  const url = 'mysql://api%40user:p%40ss@127.0.0.1:3307/universta';

  it('keeps public-key retrieval on so the sha2 handshake can complete', () => {
    expect(databaseConnectionFromUrl(url).allowPublicKeyRetrieval).toBe(true);
  });

  it('parses the connection without mangling encoded credentials', () => {
    expect(databaseConnectionFromUrl(url)).toMatchObject({
      host: '127.0.0.1',
      port: 3307,
      user: 'api@user',
      database: 'universta',
    });
  });

  it('carries both the handshake flag and the bounded timeouts', () => {
    const config = databaseAdapterConfig({
      databaseUrl: url,
      databaseConnectTimeoutMs: 1_000,
      databaseAcquireTimeoutMs: 2_500,
    });
    expect(config.allowPublicKeyRetrieval).toBe(true);
    expect(config.connectTimeout).toBe(1_000);
    expect(config.acquireTimeout).toBe(2_500);
  });

  it('keeps the acquire timeout inside the Admin BFF upstream budget', () => {
    // apps/admin/src/lib/server/auth-proxy.ts UPSTREAM_TIMEOUT_MS
    const ADMIN_BFF_UPSTREAM_TIMEOUT_MS = 5_000;
    const config = databaseAdapterConfig({
      databaseUrl: url,
      databaseConnectTimeoutMs: 1_000,
      databaseAcquireTimeoutMs: 2_500,
    });
    expect(config.acquireTimeout).toBeLessThan(ADMIN_BFF_UPSTREAM_TIMEOUT_MS);
  });
});

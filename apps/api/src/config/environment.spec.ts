import {
  parseCorsOrigins,
  requiresSecureCookies,
  validateEnvironment,
} from './environment';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '4001',
  DATABASE_URL: 'mysql://user:password@127.0.0.1:3306/universta',
  CORS_ORIGINS:
    ' http://localhost:3000, http://localhost:3001, http://localhost:3000 ',
  JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-characters-long',
};

describe('runtime environment validation', () => {
  it('normalizes a valid runtime configuration', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: 'test',
      PORT: 4001,
      DATABASE_URL: validEnvironment.DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],
      SWAGGER_ENABLED: false,
      JWT_ACCESS_SECRET: validEnvironment.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: validEnvironment.JWT_REFRESH_SECRET,
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
      AUTH_REFRESH_COOKIE_NAME: 'universta_admin_refresh',
      AUTH_MAX_FAILED_ATTEMPTS: 5,
      AUTH_LOCK_MINUTES: 15,
      /* Bounded so a database outage fails inside the Admin BFF's 5s upstream
       * budget instead of after the driver's own ~11s. */
      DATABASE_CONNECT_TIMEOUT_MS: 1000,
      DATABASE_ACQUIRE_TIMEOUT_MS: 2500,
    });
  });

  it('fails without DATABASE_URL', () => {
    const missingDatabase = { ...validEnvironment };
    delete missingDatabase.DATABASE_URL;
    expect(() => validateEnvironment(missingDatabase)).toThrow('DATABASE_URL');
    expect(() => validateEnvironment(missingDatabase)).not.toThrow('password');
  });

  it('fails for invalid ports and environments', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment, PORT: '0' }),
    ).toThrow('PORT');
    expect(() =>
      validateEnvironment({ ...validEnvironment, NODE_ENV: 'local' }),
    ).toThrow('NODE_ENV');
  });

  it('requires long, distinct JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'short',
      }),
    ).toThrow('JWT_ACCESS_SECRET');
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment.JWT_ACCESS_SECRET,
      }),
    ).toThrow('JWT_REFRESH_SECRET');
  });

  it('defaults development and test ports to 4000', () => {
    const withoutPort = { ...validEnvironment };
    delete withoutPort.PORT;
    expect(validateEnvironment(withoutPort).PORT).toBe(4000);
  });
});

describe('CORS origin parsing', () => {
  it('trims, removes empty values and deduplicates origins', () => {
    expect(
      parseCorsOrigins(
        ' http://localhost:3000, ,http://localhost:3001,http://localhost:3000 ',
      ),
    ).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('rejects wildcard, malformed and path-bearing origins', () => {
    expect(() => parseCorsOrigins('*')).toThrow('CORS_ORIGINS');
    expect(() => parseCorsOrigins('not-an-origin')).toThrow('CORS_ORIGINS');
    expect(() => parseCorsOrigins('http://localhost:3000/path')).toThrow(
      'CORS_ORIGINS',
    );
  });
});

describe('Secure cookies and origin scheme', () => {
  const base = {
    DATABASE_URL: 'mysql://user:pw@127.0.0.1:3306/universta',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    PORT: '4000',
  };

  it('refuses to start a production runtime with an http origin', () => {
    // A Secure cookie is simply not sent over http://, so the API would come up
    // healthy and every authenticated request would silently fail.
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://admin.example.test,http://example.test',
      }),
    ).toThrow(/Secure session cookies/);
  });

  it('names the offending origin so the fix is obvious', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'http://example.test',
      }),
    ).toThrow(/http:\/\/example\.test/);
  });

  it('applies the same rule to staging', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'staging',
        CORS_ORIGINS: 'http://example.test',
      }),
    ).toThrow(/Secure session cookies/);
  });

  it('accepts a production runtime whose origins are all https', () => {
    expect(() =>
      validateEnvironment({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS:
          'https://54.162.49.131.nip.io,https://admin.54.162.49.131.nip.io',
      }),
    ).not.toThrow();
  });

  it('leaves local development on http alone', () => {
    // Development does not set Secure, so http origins are correct there and
    // the check must not make localhost unusable.
    for (const nodeEnv of ['development', 'test']) {
      expect(() =>
        validateEnvironment({
          ...base,
          NODE_ENV: nodeEnv,
          CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
        }),
      ).not.toThrow();
    }
  });

  it('agrees with the cookie policy about which environments are Secure', () => {
    // If these ever disagree, the check either blocks a valid config or lets
    // the broken one through.
    expect(requiresSecureCookies('production')).toBe(true);
    expect(requiresSecureCookies('staging')).toBe(true);
    expect(requiresSecureCookies('development')).toBe(false);
    expect(requiresSecureCookies('test')).toBe(false);
  });

  /* The acquire timeout is the setting that decides whether an operator sees
   * the API's real error or the Admin proxy's timeout verdict, so it has to be
   * tunable without a code change. */
  it('accepts explicit database timeouts and rejects unusable values', () => {
    const tuned = validateEnvironment({
      ...validEnvironment,
      DATABASE_CONNECT_TIMEOUT_MS: '750',
      DATABASE_ACQUIRE_TIMEOUT_MS: '1800',
    });
    expect(tuned.DATABASE_CONNECT_TIMEOUT_MS).toBe(750);
    expect(tuned.DATABASE_ACQUIRE_TIMEOUT_MS).toBe(1800);
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_ACQUIRE_TIMEOUT_MS: '0',
      }),
    ).toThrow();
  });
});

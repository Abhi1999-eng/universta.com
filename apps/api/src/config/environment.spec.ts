import { parseCorsOrigins, validateEnvironment } from './environment';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '4001',
  DATABASE_URL: 'mysql://user:password@127.0.0.1:3306/universta',
  CORS_ORIGINS:
    ' http://localhost:3000, http://localhost:3001, http://localhost:3000 ',
};

describe('runtime environment validation', () => {
  it('normalizes a valid runtime configuration', () => {
    expect(validateEnvironment(validEnvironment)).toEqual({
      NODE_ENV: 'test',
      PORT: 4001,
      DATABASE_URL: validEnvironment.DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],
      SWAGGER_ENABLED: false,
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

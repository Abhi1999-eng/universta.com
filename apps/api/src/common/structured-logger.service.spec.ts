import {
  redactSensitiveFields,
  StructuredLogger,
} from './structured-logger.service';

describe('structured logging redaction', () => {
  it('redacts sensitive fields and database URLs', () => {
    expect(
      redactSensitiveFields({
        authorization: 'Bearer secret',
        password: 'secret',
        accessToken: 'access-secret',
        refresh_token: 'refresh-secret',
        jwtSecret: 'jwt-secret',
        cookie: 'refresh=secret',
        databaseUrl: 'mysql://user:password@localhost:3306/universta',
        safe: 'value',
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      jwtSecret: '[REDACTED]',
      cookie: '[REDACTED]',
      databaseUrl: '[REDACTED]',
      safe: 'value',
    });
  });

  it('writes structured request fields without request or response bodies', () => {
    const logger = new StructuredLogger();
    const infoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    logger.logRequest({
      requestId: 'request-1',
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: 2,
    });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"request-1"'),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('"statusCode":200'),
    );
    infoSpy.mockRestore();
  });
});

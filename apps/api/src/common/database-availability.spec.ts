import { Prisma } from '../generated/prisma/client';
import { isDatabaseUnavailableError } from './database-availability';

/**
 * The shape asserted here was captured from the running stack: with the
 * database unreachable, `prisma.user.findUnique` rejects with a
 * `PrismaClientKnownRequestError` carrying code `P2039` and the mariadb pool's
 * own error number 45028 (ER_GET_CONNECTION_TIMEOUT) inside the message. That
 * is the failure the deployed Admin login hit.
 */
describe('isDatabaseUnavailableError', () => {
  it('recognises the pool acquisition timeout Prisma reports as P2039', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.user.findUnique()` invocation\nDatabase error. Code: `45028`. Message: `retrieve connection from pool timeout after 10001ms`',
      { code: 'P2039', clientVersion: '6.0.0' },
    );
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('recognises the connectivity codes Prisma names directly', () => {
    for (const code of ['P1001', 'P1002', 'P1008', 'P1017', 'P2024']) {
      const error = new Prisma.PrismaClientKnownRequestError('unreachable', {
        code,
        clientVersion: '6.0.0',
      });
      expect(isDatabaseUnavailableError(error)).toBe(true);
    }
  });

  it('recognises a failure to start up against the database', () => {
    const error = Object.assign(new Error("Can't reach database server"), {
      name: 'PrismaClientInitializationError',
    });
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it('recognises a raw socket failure and one wrapped as a cause', () => {
    const socket = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    expect(isDatabaseUnavailableError(socket)).toBe(true);
    expect(
      isDatabaseUnavailableError(
        Object.assign(new Error('adapter failed'), { cause: socket }),
      ),
    ).toBe(true);
  });

  it('leaves a query that failed on its own merits alone', () => {
    // A unique-constraint violation is the request's fault, not the server's,
    // and must keep reporting exactly as it does today.
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`slug`)',
      { code: 'P2002', clientVersion: '6.0.0' },
    );
    expect(isDatabaseUnavailableError(conflict)).toBe(false);
    // A driver error that is not about connectivity stays out too.
    const badColumn = new Prisma.PrismaClientKnownRequestError(
      'Database error. Code: `1054`. Message: `Unknown column`',
      { code: 'P2039', clientVersion: '6.0.0' },
    );
    expect(isDatabaseUnavailableError(badColumn)).toBe(false);
    expect(isDatabaseUnavailableError(new Error('boom'))).toBe(false);
    expect(isDatabaseUnavailableError(null)).toBe(false);
  });
});

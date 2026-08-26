/**
 * Recognising "the database is unreachable" as its own failure.
 *
 * A driver-level connectivity failure arrives as an ordinary rejected promise,
 * so `AppExceptionFilter` had no way to tell it apart from a bug in a handler
 * and answered every request with 500 INTERNAL_ERROR. During a database
 * outage that made the whole API opaque: the Admin console, the public site
 * and the operator all saw "Internal server error" with no indication that
 * nothing was wrong with the request itself.
 *
 * The shape below is what the stack actually produces. With the MariaDB
 * driver adapter, Prisma reports a pool acquisition failure as
 * `PrismaClientKnownRequestError` with code `P2039` and the driver's own error
 * number in the message ("Database error. Code: `45028`"), where 45028 is
 * mariadb's ER_GET_CONNECTION_TIMEOUT. Boot-time failures surface as
 * `PrismaClientInitializationError` with the P1xxx codes instead.
 */

/** Prisma codes that mean the server could not be reached or answered. */
const PRISMA_CONNECTIVITY_CODES = new Set([
  'P1000', // authentication failed against the database server
  'P1001', // can't reach database server
  'P1002', // database server reached but timed out
  'P1008', // operation timed out
  'P1017', // server has closed the connection
  'P2024', // timed out fetching a connection from the pool
]);

/** mariadb client error numbers that mean the connection, not the query. */
const DRIVER_CONNECTIVITY_ERRNOS = new Set([
  45009, // ER_SOCKET_UNEXPECTED_CLOSE
  45012, // ER_CONNECTION_TIMEOUT
  45013, // ER_CMD_CONNECTION_CLOSED
  45019, // ER_SOCKET
  45026, // ER_SOCKET_TIMEOUT
  45028, // ER_GET_CONNECTION_TIMEOUT
  45039, // ER_INITIAL_TIMEOUT_ERROR
]);

/** Node socket failures, in case one reaches the filter unwrapped. */
const SOCKET_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
]);

function driverErrnoFromMessage(message: string): number | null {
  // Prisma folds the driver error into the message rather than onto a field.
  const match = /Database error\. Code: `?(\d+)`?/.exec(message);
  return match ? Number(match[1]) : null;
}

function errnoOf(value: Record<string, unknown>): number | null {
  return typeof value.errno === 'number' ? value.errno : null;
}

/**
 * True when the failure is the database being unreachable rather than the
 * request being wrong. Deliberately narrow: a query that fails on its own
 * merits (a constraint, a bad column) must keep reporting as it does today.
 */
export function isDatabaseUnavailableError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) {
    return false;
  }
  const candidate = error as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message =
    typeof candidate.message === 'string' ? candidate.message : '';

  if (name === 'PrismaClientInitializationError') {
    return true;
  }
  if (PRISMA_CONNECTIVITY_CODES.has(code) || SOCKET_ERROR_CODES.has(code)) {
    return true;
  }

  const errno = errnoOf(candidate) ?? driverErrnoFromMessage(message);
  if (errno !== null && DRIVER_CONNECTIVITY_ERRNOS.has(errno)) {
    return true;
  }

  // Driver adapters wrap the original failure; follow the chain a short way.
  return isDatabaseUnavailableError(candidate.cause, depth + 1);
}

export const DATABASE_UNAVAILABLE_CODE = 'DATABASE_UNAVAILABLE';
export const DATABASE_UNAVAILABLE_MESSAGE =
  'Database is temporarily unavailable';

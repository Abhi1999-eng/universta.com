import { Injectable } from '@nestjs/common';

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|password[-_]?hash|access[-_]?token|refresh[-_]?token|reset[-_]?token|database(url|password)?|jwt([-_]?secret)?|api[-_]?key)/i;
const DATABASE_URL_PATTERN = /(?:mysql|mariadb):\/\/[^\s"'`]+/gi;

export function redactSensitiveFields(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return value.replace(DATABASE_URL_PATTERN, '[REDACTED_DATABASE_URL]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitiveFields(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

@Injectable()
export class StructuredLogger {
  logRequest(entry: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }): void {
    this.write('info', { ...entry, timestamp: new Date().toISOString() });
  }

  /** Info-level application event. Goes through the same redaction as every
   * other line, so a caller cannot accidentally log a secret. */
  logEvent(message: string, details: Record<string, unknown> = {}): void {
    this.write('info', {
      message,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logError(message: string, details: Record<string, unknown> = {}): void {
    this.write('error', {
      message,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  private write(level: 'info' | 'error', entry: Record<string, unknown>): void {
    const safeEntry = redactSensitiveFields({ level, ...entry }) as Record<
      string,
      unknown
    >;
    const output = JSON.stringify(safeEntry);
    if (level === 'error') {
      console.error(output);
    } else {
      console.info(output);
    }
  }
}

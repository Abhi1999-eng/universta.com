import {
  HttpException,
  HttpStatus,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { PUBLIC_LEAD_BODY_LIMIT_BYTES } from './leads.constants';

type RateEntry = { count: number; expiresAt: number };

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;
const MAX_RATE_KEYS = 5_000;

@Injectable()
export class LeadProtectionService {
  private readonly entries = new Map<string, RateEntry>();
  private readonly salt = randomBytes(32);
  private lastCleanupAt = 0;

  constructor(private readonly runtimeConfig: RuntimeConfigService) {}

  assertOrigin(origin: string | undefined): void {
    if (!origin) return;
    let normalized: string;
    try {
      normalized = new URL(origin).origin;
    } catch {
      throw this.invalidOrigin();
    }
    if (
      normalized !== origin ||
      !this.runtimeConfig.corsOrigins.includes(normalized)
    ) {
      throw this.invalidOrigin();
    }
  }

  assertBodySize(contentLength: string | undefined, value: unknown): void {
    const declared = Number(contentLength ?? 0);
    const actual = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (
      (Number.isFinite(declared) && declared > PUBLIC_LEAD_BODY_LIMIT_BYTES) ||
      actual > PUBLIC_LEAD_BODY_LIMIT_BYTES
    ) {
      throw new PayloadTooLargeException({
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body is too large',
        details: null,
      });
    }
  }

  assertRateLimit(
    email: string,
    phoneNumber: string,
    response: Response,
    now = Date.now(),
  ): void {
    this.cleanup(now);
    const key = this.hash(`${email}\u0000${phoneNumber}`);
    const current = this.entries.get(key);
    if (current && current.expiresAt > now && current.count >= RATE_LIMIT) {
      response.setHeader(
        'retry-after',
        String(Math.max(1, Math.ceil((current.expiresAt - now) / 1000))),
      );
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (current && current.expiresAt > now) {
      current.count += 1;
      return;
    }
    if (this.entries.size >= MAX_RATE_KEYS) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest) this.entries.delete(oldest);
    }
    this.entries.set(key, { count: 1, expiresAt: now + RATE_WINDOW_MS });
  }

  private cleanup(now: number): void {
    if (
      now - this.lastCleanupAt < 60_000 &&
      this.entries.size < MAX_RATE_KEYS
    ) {
      return;
    }
    this.lastCleanupAt = now;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private hash(value: string): string {
    return createHash('sha256').update(this.salt).update(value).digest('hex');
  }

  private invalidOrigin(): HttpException {
    return new HttpException(
      {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin is not allowed',
        details: null,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

import { HttpException, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { LeadProtectionService } from './lead-protection.service';

describe('LeadProtectionService', () => {
  const config = {
    corsOrigins: ['http://localhost:3000'],
  } as RuntimeConfigService;

  it('allows configured or absent origins and rejects other origins', () => {
    const service = new LeadProtectionService(config);
    expect(() => service.assertOrigin(undefined)).not.toThrow();
    expect(() => service.assertOrigin('http://localhost:3000')).not.toThrow();
    expect(() => service.assertOrigin('https://attacker.example')).toThrow(
      HttpException,
    );
  });

  it('enforces the endpoint body size cap', () => {
    const service = new LeadProtectionService(config);
    expect(() => service.assertBodySize('20', { safe: true })).not.toThrow();
    expect(() =>
      service.assertBodySize(String(20 * 1024), { safe: true }),
    ).toThrow(PayloadTooLargeException);
  });

  it('returns a retry-after value when the bounded contact limit is reached', () => {
    const service = new LeadProtectionService(config);
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    for (let index = 0; index < 8; index += 1) {
      service.assertRateLimit(
        'fictional@example.invalid',
        '+15550102020',
        response,
        1_000,
      );
    }
    expect(() =>
      service.assertRateLimit(
        'fictional@example.invalid',
        '+15550102020',
        response,
        1_000,
      ),
    ).toThrow(HttpException);
    expect(setHeader).toHaveBeenCalledWith('retry-after', expect.any(String));
  });
});

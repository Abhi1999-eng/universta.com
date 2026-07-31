import { ConfigService } from '@nestjs/config';
import { RuntimeConfigService } from '../config/runtime-config.service';

function config(origins: string[]) {
  return new RuntimeConfigService({
    getOrThrow: (key: string) => (key === 'CORS_ORIGINS' ? origins : ''),
  } as ConfigService<never, true>);
}

describe('RuntimeConfigService.webOrigin', () => {
  it('selects the production web origin instead of Admin', () => {
    expect(
      config([
        'https://admin.54.162.49.131.nip.io',
        'https://54.162.49.131.nip.io',
      ]).webOrigin,
    ).toBe('https://54.162.49.131.nip.io');
  });

  it('selects localhost web port instead of Admin port', () => {
    expect(
      config(['http://localhost:3001', 'http://localhost:3000']).webOrigin,
    ).toBe('http://localhost:3000');
  });

  it('normalizes a trailing slash', () => {
    expect(config(['https://example.com/']).webOrigin).toBe(
      'https://example.com',
    );
  });

  it('ignores malformed configured origins', () => {
    expect(config(['not-a-url', 'https://example.com']).webOrigin).toBe(
      'https://example.com',
    );
  });

  it('rejects an Admin-only origin rather than framing the console', () => {
    expect(() => config(['https://admin.example.com']).webOrigin).toThrow(
      'public web origin',
    );
  });
});

import { SettingsService } from './settings.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StructuredLogger } from '../common/structured-logger.service';

/** ISS-039. `assertSafeUrl`'s guard against an unsafe URL let a
 * protocol-relative "//host" value straight through: `/^(\/[^\s]*|...)$/`
 * only checked for a leading slash, and "//evil.example.com" starts with
 * one. A browser treats a leading "//" as "keep the current scheme, but go
 * to this other host entirely" -- the classic open-redirect bypass this
 * check exists to block, on every URL field across header/footer/contact/
 * social settings (ctaUrl, announcementUrl, accountCtaUrl, privacyUrl,
 * termsUrl, counsellingCtaUrl, whatsappLink, and all 5 social links).
 * Reproduced live via the admin API against `contact.whatsappLink` while
 * acceptance-testing Module 7 (Global Settings). */

function fakePrisma() {
  return {
    siteSetting: {
      findMany: async () => [],
      upsert: async ({ create }: { create: Record<string, unknown> }) => create,
    },
  } as unknown as PrismaService;
}

function service() {
  return new SettingsService(fakePrisma(), {} as StructuredLogger);
}

describe('SettingsService.update -- open-redirect guard (ISS-039)', () => {
  it('rejects a protocol-relative "//host" URL', async () => {
    await expect(
      service().update('contact', { whatsappLink: '//evil.example.com' }),
    ).rejects.toMatchObject({ response: { code: 'UNSAFE_URL' } });
  });

  it('still allows a genuine site-relative path', async () => {
    await expect(
      service().update('header', { ctaUrl: '/counselling' }),
    ).resolves.toBeDefined();
  });

  it('still allows a genuine https:// URL', async () => {
    await expect(
      service().update('social', {
        facebook: 'https://facebook.com/universta',
      }),
    ).resolves.toBeDefined();
  });

  it('still rejects a bare javascript: URL', async () => {
    await expect(
      service().update('header', { ctaUrl: 'javascript:alert(1)' }),
    ).rejects.toMatchObject({ response: { code: 'UNSAFE_URL' } });
  });
});

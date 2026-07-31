import { JwtService } from '@nestjs/jwt';
import { ForbiddenException } from '@nestjs/common';
import { PreviewService } from './preview.service';

/** Preview tokens are the only thing standing between an anonymous request and
 * unpublished content, so the rejection paths matter more than the happy one. */

const SECRET = 'test-preview-secret';
const OTHER_SECRET = 'a-different-secret';

function build(
  page: unknown = { id: 'p1', slug: 'about', status: 'DRAFT', sections: [] },
) {
  const jwt = new JwtService({});
  const runtimeConfig = { jwtAccessSecret: SECRET } as never;
  const prisma = {
    page: { findFirst: jest.fn().mockResolvedValue(page) },
  } as never;
  return {
    service: new PreviewService(jwt, runtimeConfig, prisma),
    jwt,
    prisma,
  };
}

async function expectForbidden(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
  await promise.catch((error: ForbiddenException) => {
    expect((error.getResponse() as { code: string }).code).toBe(code);
  });
}

describe('PreviewService', () => {
  it('issues a scoped token with a bounded lifetime', async () => {
    const { service } = build();
    const issued = await service.issue('page', 'about', 'admin-1');
    expect(issued.ttlSeconds).toBe(1800);
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(issued.token.split('.')).toHaveLength(3);
  });

  it('returns draft content for a valid token', async () => {
    const { service, prisma } = build();
    const { token } = await service.issue('page', 'about', 'admin-1');
    const page = await service.previewPage('about', token);
    expect(page).toMatchObject({ slug: 'about', status: 'DRAFT' });
    // No status filter: a draft page must be reachable, a deleted one must not.
    const where = (prisma as unknown as { page: { findFirst: jest.Mock } }).page
      .findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ slug: 'about', deletedAt: null });
  });

  it('rejects an empty or malformed token', async () => {
    const { service } = build();
    await expectForbidden(
      service.previewPage('about', ''),
      'PREVIEW_TOKEN_INVALID',
    );
    await expectForbidden(
      service.previewPage('about', 'not.a.jwt'),
      'PREVIEW_TOKEN_INVALID',
    );
  });

  it('rejects an expired token', async () => {
    const { service } = build();
    const expired = await new JwtService({}).signAsync(
      { type: 'preview', target: 'page', ref: 'about', sub: 'admin-1' },
      {
        secret: SECRET,
        expiresIn: -60,
        issuer: 'universta',
        audience: 'universta-preview',
      },
    );
    await expectForbidden(
      service.previewPage('about', expired),
      'PREVIEW_TOKEN_INVALID',
    );
  });

  it('rejects a token signed with the wrong secret', async () => {
    const { service } = build();
    const forged = await new JwtService({}).signAsync(
      { type: 'preview', target: 'page', ref: 'about', sub: 'admin-1' },
      {
        secret: OTHER_SECRET,
        expiresIn: 600,
        issuer: 'universta',
        audience: 'universta-preview',
      },
    );
    await expectForbidden(
      service.previewPage('about', forged),
      'PREVIEW_TOKEN_INVALID',
    );
  });

  it('rejects an access token presented as a preview token', async () => {
    const { service } = build();
    const accessShaped = await new JwtService({}).signAsync(
      { type: 'access', sub: 'admin-1' },
      {
        secret: SECRET,
        expiresIn: 600,
        issuer: 'universta',
        audience: 'universta-preview',
      },
    );
    await expectForbidden(
      service.previewPage('about', accessShaped),
      'PREVIEW_TOKEN_INVALID',
    );
  });

  it('rejects a valid token issued for a different page', async () => {
    const { service } = build();
    const { token } = await service.issue('page', 'about', 'admin-1');
    await expectForbidden(
      service.previewPage('faq', token),
      'PREVIEW_TOKEN_SCOPE',
    );
  });

  it('reports a missing page without leaking whether it ever existed', async () => {
    const { service } = build(null);
    const { token } = await service.issue('page', 'about', 'admin-1');
    await expectForbidden(
      service.previewPage('about', token),
      'PREVIEW_TARGET_MISSING',
    );
  });
});

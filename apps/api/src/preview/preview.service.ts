import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { PrismaService } from '../prisma/prisma.service';

/** Draft preview for Website Builder.
 *
 * Draft content must never be reachable from a plain public URL, so preview is
 * gated by a short-lived signed token rather than a query flag. The token is a
 * JWT signed with the existing access-token secret and carries its own type, so
 * it can neither be used as an admin access token nor accepted by the admin
 * guards. It is issued only to an authenticated Super Admin, expires quickly,
 * and is scoped to a single page or template.
 *
 * Nothing is persisted: expiry is carried in the token itself, so there is no
 * token table to migrate, sweep or leak. */

const PREVIEW_TOKEN_TYPE = 'preview';
const PREVIEW_ISSUER = 'universta';
const PREVIEW_AUDIENCE = 'universta-preview';
/** Long enough to click through Desktop/Tablet/Mobile, short enough that a
 * copied preview URL stops working quickly. */
const PREVIEW_TTL_SECONDS = 30 * 60;

type PreviewTokenPayload = {
  type: typeof PREVIEW_TOKEN_TYPE;
  /** "page" | "template" */
  target: string;
  /** page id/slug, or template key */
  ref: string;
  sub: string;
};

@Injectable()
export class PreviewService {
  constructor(
    private readonly jwt: JwtService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(target: string, ref: string, actorUserId: string) {
    const token = await this.jwt.signAsync<PreviewTokenPayload>(
      { type: PREVIEW_TOKEN_TYPE, target, ref, sub: actorUserId },
      {
        secret: this.runtimeConfig.jwtAccessSecret,
        expiresIn: PREVIEW_TTL_SECONDS,
        issuer: PREVIEW_ISSUER,
        audience: PREVIEW_AUDIENCE,
      },
    );
    return {
      token,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString(),
      ttlSeconds: PREVIEW_TTL_SECONDS,
    };
  }

  private async verify(token: string): Promise<PreviewTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<PreviewTokenPayload>(token, {
        secret: this.runtimeConfig.jwtAccessSecret,
        issuer: PREVIEW_ISSUER,
        audience: PREVIEW_AUDIENCE,
      });
      if (payload?.type !== PREVIEW_TOKEN_TYPE) throw new Error('wrong type');
      return payload;
    } catch {
      throw new ForbiddenException({
        code: 'PREVIEW_TOKEN_INVALID',
        message: 'This preview link is invalid or has expired.',
        details: null,
      });
    }
  }

  /** Returns a page including DRAFT content, but only for a valid token that
   * was issued for that exact page. */
  async previewPage(slug: string, token: string) {
    const payload = await this.verify(token);
    if (payload.target !== 'page' || payload.ref !== slug)
      throw new ForbiddenException({
        code: 'PREVIEW_TOKEN_SCOPE',
        message: 'This preview link is not valid for that page.',
        details: null,
      });
    const page = await this.prisma.page.findFirst({
      // Deliberately no status filter: previewing a draft is the whole point.
      // Soft-deleted pages stay excluded.
      where: { slug, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
          include: { media: true },
        },
      },
    });
    if (!page)
      throw new ForbiddenException({
        code: 'PREVIEW_TARGET_MISSING',
        message: 'That page no longer exists.',
        details: null,
      });
    return page;
  }
}

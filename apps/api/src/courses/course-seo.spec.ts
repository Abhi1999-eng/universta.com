import { CoursesService } from './courses.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * A course's SEO as its editors save it: the canonical URL takes a path on
 * this site as a subject's does, and the row is written whole, so a field
 * cleared in the editor is cleared in the database.
 */

type Row = Record<string, unknown>;

/* An SEO row stored the way Prisma stores an update: a key that is
   undefined is left as it was. */
function fakeDb(stored: Row | null = null) {
  const db = { seo: stored };
  const defined = (data: Row) =>
    Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
  const prisma = {
    course: {
      findFirst: async () => ({ id: 'mba', slug: 'mba', deletedAt: null }),
    },
    seoMetadata: {
      findUnique: async () => db.seo,
      upsert: async ({ create, update }: { create: Row; update: Row }) => {
        db.seo = db.seo
          ? { ...db.seo, ...defined(update) }
          : { id: 'seo-1', ...defined(create) };
        return db.seo;
      },
    },
    auditLog: { create: async () => null },
  };
  return {
    db,
    service: new CoursesService(prisma as unknown as PrismaService),
  };
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;
const base = { seoTitle: 'Study an MBA', metaDescription: 'Where and why.' };

describe('saving a course SEO', () => {
  it('accepts a canonical on this site and an https one', async () => {
    const { service } = fakeDb();
    await expect(
      service.putSeo('mba', { ...base, canonicalUrl: '/courses/x' }, request),
    ).resolves.toMatchObject({ canonicalUrl: '/courses/x' });
    await expect(
      service.putSeo(
        'mba',
        { ...base, canonicalUrl: 'https://universta.com/courses/x' },
        request,
      ),
    ).resolves.toMatchObject({
      canonicalUrl: 'https://universta.com/courses/x',
    });
  });

  it('refuses a script canonical and one on another host without a scheme', async () => {
    const { service } = fakeDb();
    for (const canonicalUrl of ['javascript:alert(1)', '//evil.example'])
      await expect(
        service.putSeo('mba', { ...base, canonicalUrl }, request),
      ).rejects.toMatchObject({
        response: {
          code: 'SEO_URL_INVALID',
          message:
            'Canonical URL must be a site path beginning with / or an http(s) URL',
        },
      });
  });

  it('clears a field the editor cleared, left out or sent empty', async () => {
    const { service, db } = fakeDb({
      id: 'seo-1',
      ownerType: 'COURSE',
      ownerId: 'mba',
      ...base,
      canonicalUrl: '/courses/old',
      focusKeyword: 'mba abroad',
      ogTitle: 'Old OG',
      ogMediaId: 'img-1',
      twitterMediaId: 'img-2',
      schemaJson: { '@type': 'Course' },
    });
    /* The course form leaves a cleared field out; the editorial tab sends
       it as an empty string. */
    await service.putSeo('mba', { ...base, ogTitle: '' }, request);
    expect(db.seo).toMatchObject({
      canonicalUrl: null,
      focusKeyword: null,
      ogTitle: null,
      ogMediaId: null,
      twitterMediaId: null,
      /* Not on the editor's form, so not cleared by leaving it out. */
      schemaJson: { '@type': 'Course' },
    });
  });
});

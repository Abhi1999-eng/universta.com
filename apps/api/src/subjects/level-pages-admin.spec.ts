import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubjectLevelPagesService } from './level-pages.service';
import { UpsertLevelPageDto } from './dto/level-page.dto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';

/**
 * A study level's page as an editor writes it, for a subject or one of its
 * specializations: which levels a field has a page at and why, saving the
 * intro, notes, questions and SEO together under one version, and deleting
 * what was written.
 *
 * The database is a small in-memory one that answers the queries the
 * service makes, so a test can state the catalogue and read back what was
 * stored.
 */

type Row = Record<string, any>;

/* FOUNDATION's id was made by MySQL's UUID() (a v1 id), as on production. */
const FOUNDATION_ID = '611d01d5-c8c8-11f1-af26-deb71be0da61';
const level = (
  id: string,
  code: string,
  name: string,
  educationOrder: number,
  status = 'ACTIVE',
) => ({
  id,
  code,
  name,
  description: null,
  status,
  educationOrder,
  displayOrder: educationOrder,
});
const LEVELS = [
  level(FOUNDATION_ID, 'FOUNDATION', 'Foundation Program', 1),
  level('ug', 'UG', "Bachelor's", 3),
  level('pg', 'PG', "Master's", 4),
  level('mba', 'MBA', 'MBA', 5),
  level('phd', 'PHD', 'PhD', 6),
  /* Switched off under "All levels". */
  level('dip', 'DIPLOMA', 'Diploma', 7, 'INACTIVE'),
];
const SUBJECTS = [
  {
    id: 'cs',
    name: 'Computer Science',
    slug: 'computer-science',
    status: 'PUBLISHED',
    deletedAt: null,
  },
  {
    id: 'empty',
    name: 'Philosophy',
    slug: 'philosophy',
    status: 'DRAFT',
    deletedAt: null,
  },
];
const SPECIALIZATIONS = [
  {
    id: 'ai',
    subjectId: 'cs',
    name: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
    status: 'PUBLISHED',
    deletedAt: null,
  },
  {
    id: 'ds',
    subjectId: 'cs',
    name: 'Data Science',
    slug: 'data-science',
    status: 'DRAFT',
    deletedAt: null,
  },
];

/**
 * The catalogue these tests run on, unless a test says otherwise:
 * - Computer Science is ticked for Bachelor's and for the switched-off
 *   Diploma;
 * - its published specialization AI is ticked for PhD and teaches a
 *   published Master's course; its draft specialization Data Science is
 *   ticked for MBA;
 * - a draft Foundation course counts for nothing.
 */
function fakeDb(seed: Partial<Record<string, Row[]>> = {}) {
  const db: Record<string, any[]> = {
    levels: LEVELS,
    subjects: SUBJECTS,
    specializations: SPECIALIZATIONS,
    subjectTicks: [
      { subjectId: 'cs', courseLevelId: 'ug' },
      { subjectId: 'cs', courseLevelId: 'dip' },
    ],
    specTicks: [
      { subSubjectId: 'ai', courseLevelId: 'phd' },
      { subSubjectId: 'ds', courseLevelId: 'mba' },
    ],
    courses: [
      {
        subjectId: 'cs',
        subSubjectId: 'ai',
        courseLevelId: 'pg',
        status: 'PUBLISHED',
        deletedAt: null,
      },
      {
        subjectId: 'cs',
        subSubjectId: null,
        courseLevelId: FOUNDATION_ID,
        status: 'DRAFT',
        deletedAt: null,
      },
    ],
    pages: [],
    faqs: [],
    seo: [],
    media: [
      { id: 'img-live', status: 'ACTIVE', mediaType: 'IMAGE', deletedAt: null },
      {
        id: 'img-gone',
        status: 'INACTIVE',
        mediaType: 'IMAGE',
        deletedAt: null,
      },
    ],
    audits: [],
    ...seed,
  };
  const calls: string[] = [];
  /* Another session's save, landing after this one read and checked the
     page and before it writes. */
  const hooks: { beforeTransaction?: () => Promise<unknown> } = {};
  let inTransaction = false;
  let clock = Date.parse('2026-10-17T10:00:00.000Z');
  let ids = 0;
  const now = () => new Date((clock += 1000));
  const write = (name: string) =>
    calls.push(`${name}${inTransaction ? ' (in transaction)' : ''}`);
  const spec = (id: any) => db.specializations.find((row) => row.id === id);
  const faqsOf = (pageId: any) =>
    db.faqs
      .filter((faq) => faq.pageId === pageId)
      .sort(
        (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
      );
  const pageByKey = (key: any) =>
    db.pages.find(
      (page) =>
        page.subjectId === key.subjectId &&
        page.scopeKey === key.scopeKey &&
        page.courseLevelId === key.courseLevelId,
    );
  const withIncludes = (page: any, include: any = {}) => ({
    ...page,
    ...(include.faqs ? { faqs: faqsOf(page.id) } : {}),
    ...(include._count
      ? {
          _count: {
            faqs: faqsOf(page.id).filter(
              (faq) =>
                include._count.select.faqs === true ||
                faq.status === include._count.select.faqs.where.status,
            ).length,
          },
        }
      : {}),
  });
  const atVersion = (where: any) =>
    db.pages.find(
      (page) =>
        page.id === where.id &&
        page.updatedAt.getTime() === where.updatedAt.getTime(),
    );
  const defined = (data: unknown) =>
    Object.fromEntries(
      Object.entries(data as Row).filter(([, value]) => value !== undefined),
    );
  const live = (row: any) => row.status === 'PUBLISHED' && !row.deletedAt;

  const prisma: Row = {
    subject: {
      findFirst: async ({ where }: Row) =>
        db.subjects.find((row) => row.id === where.id && !row.deletedAt) ??
        null,
    },
    subSubject: {
      findFirst: async ({ where }: Row) => {
        const row = spec(where.id);
        const parent = db.subjects.find((s) => s.id === row?.subjectId);
        if (!row || row.deletedAt || !parent || parent.deletedAt) return null;
        return {
          id: row.id,
          name: row.name,
          slug: row.slug,
          status: row.status,
          subject: parent,
        };
      },
    },
    courseLevel: {
      findMany: async () => db.levels,
      findUnique: async ({ where }: Row) =>
        db.levels.find((row) => row.id === where.id) ?? null,
    },
    subjectCourseLevel: {
      findMany: async ({ where }: Row) =>
        db.subjectTicks.filter((tick) => tick.subjectId === where.subjectId),
    },
    subSubjectCourseLevel: {
      findMany: async ({ where }: Row) =>
        db.specTicks.filter((tick) =>
          where.subSubjectId
            ? tick.subSubjectId === where.subSubjectId
            : spec(tick.subSubjectId)?.subjectId ===
                where.subSubject.subjectId &&
              live(spec(tick.subSubjectId) ?? {}),
        ),
    },
    course: {
      groupBy: async ({ where }: Row) => {
        const levels = db.courses
          .filter(
            (course) =>
              live(course) &&
              (where.subSubjectId
                ? course.subSubjectId === where.subSubjectId
                : course.subjectId === where.subjectId),
          )
          .map((course) => course.courseLevelId);
        return [...new Set(levels)].map((courseLevelId) => ({ courseLevelId }));
      },
    },
    subjectLevelPage: {
      findMany: async ({ where, include }: Row) =>
        db.pages
          .filter(
            (page) =>
              page.subjectId === where.subjectId &&
              page.scopeKey === where.scopeKey,
          )
          .map((page) => withIncludes(page, include)),
      findUnique: async ({ where, include }: Row) => {
        const page = pageByKey(where.subjectId_scopeKey_courseLevelId);
        return page ? withIncludes(page, include) : null;
      },
      create: async ({ data }: Row) => {
        write('subjectLevelPage.create');
        if (db.failCreate?.length || pageByKey(data))
          throw Object.assign(new Error('Unique constraint'), {
            code: 'P2002',
          });
        const stamp = now();
        const row = {
          id: `page-${++ids}`,
          intro: null,
          admissionNote: null,
          careersNote: null,
          status: 'DRAFT',
          ...data,
          createdAt: stamp,
          updatedAt: stamp,
        };
        db.pages.push(row);
        return row;
      },
      /* Both write the page only at the version the service read. */
      updateMany: async ({ where, data }: Row) => {
        write(
          `subjectLevelPage.updateMany ${JSON.stringify(Object.keys(data as Row))}`,
        );
        const page = atVersion(where);
        if (!page) return { count: 0 };
        Object.assign(page, data, { updatedAt: now() });
        return { count: 1 };
      },
      deleteMany: async ({ where }: Row) => {
        write('subjectLevelPage.deleteMany');
        const page = atVersion(where);
        if (!page) return { count: 0 };
        db.pages = db.pages.filter((row) => row !== page);
        /* The questions cascade. */
        db.faqs = db.faqs.filter((row) => row.pageId !== page.id);
        return { count: 1 };
      },
    },
    subjectLevelPageFaq: {
      deleteMany: async ({ where }: Row) => {
        write('subjectLevelPageFaq.deleteMany');
        db.faqs = db.faqs.filter((row) => row.pageId !== where.pageId);
        return {};
      },
      createMany: async ({ data }: Row) => {
        write('subjectLevelPageFaq.createMany');
        for (const faq of data as Row[]) {
          const stamp = now();
          db.faqs.push({
            id: `faq-${++ids}`,
            ...faq,
            createdAt: stamp,
            updatedAt: stamp,
          });
        }
        return {};
      },
    },
    seoMetadata: {
      findMany: async ({ where }: Row) =>
        db.seo.filter(
          (row) =>
            row.ownerType === where.ownerType &&
            where.ownerId.in.includes(row.ownerId),
        ),
      findUnique: async ({ where }: Row) => {
        const key = where.ownerType_ownerId;
        const row = db.seo.find(
          (seo) =>
            seo.ownerType === key.ownerType && seo.ownerId === key.ownerId,
        );
        return row ? { ...row, ogMedia: null, twitterMedia: null } : null;
      },
      upsert: async ({ where, create, update }: Row) => {
        write('seoMetadata.upsert');
        const key = where.ownerType_ownerId;
        const row = db.seo.find(
          (seo) =>
            seo.ownerType === key.ownerType && seo.ownerId === key.ownerId,
        );
        if (row) return Object.assign(row, defined(update));
        const created = { id: `seo-${++ids}`, ...defined(create) };
        db.seo.push(created);
        return created;
      },
      deleteMany: async ({ where }: Row) => {
        write(`seoMetadata.deleteMany ${JSON.stringify(where)}`);
        db.seo = db.seo.filter(
          (row) =>
            !(
              row.ownerType === where.ownerType && row.ownerId === where.ownerId
            ),
        );
        return {};
      },
    },
    mediaAsset: {
      count: async ({ where }: Row) =>
        db.media.filter(
          (row) =>
            where.id.in.includes(row.id) &&
            row.status === where.status &&
            row.mediaType === where.mediaType &&
            !row.deletedAt,
        ).length,
    },
    $transaction: async (work: unknown) => {
      if (typeof work !== 'function') {
        calls.push(`$transaction [${(work as unknown[]).length}]`);
        return Promise.all(work as Promise<unknown>[]);
      }
      calls.push('$transaction');
      const landing = hooks.beforeTransaction;
      if (landing) {
        delete hooks.beforeTransaction;
        await landing();
      }
      inTransaction = true;
      try {
        return await (work as (tx: unknown) => Promise<unknown>)(prisma);
      } finally {
        inTransaction = false;
      }
    },
    auditLog: {
      create: async ({ data }: Row) => {
        db.audits.push(data);
        return null;
      },
    },
  };
  return {
    db,
    calls,
    hooks,
    service: new SubjectLevelPagesService(prisma as unknown as PrismaService),
  };
}

const request = {
  user: { sub: 'admin-1' },
  headers: {},
  ip: '127.0.0.1',
  get: () => undefined,
} as unknown as AuthenticatedRequest;
const SUBJECT = { kind: 'subject', id: 'cs' } as const;
const AI = { kind: 'specialization', id: 'ai' } as const;
const faq = (n: number, status = 'ACTIVE') => ({
  question: `Question ${n}?`,
  answer: `<p>Answer ${n}.</p>`,
  status,
});
const conflict = (code: string) => ({ response: { code } });

describe('the levels a field has a page at', () => {
  it("lists a subject's ticks, its published specializations' ticks and its courses' levels, in climbing order", async () => {
    const { service } = fakeDb();
    const rows = await service.list(SUBJECT);
    expect(
      rows.map((row) => [row.level.code, row.offered, row.sources]),
    ).toEqual([
      ['UG', true, ['TICKED']],
      ['PG', true, ['COURSES']],
      ['PHD', true, ['SPECIALIZATION']],
    ]);
  });

  it("leaves out a draft specialization's ticks, a switched-off level and a draft course", async () => {
    const { service } = fakeDb();
    const codes = (await service.list(SUBJECT)).map((row) => row.level.code);
    expect(codes).not.toContain('MBA');
    expect(codes).not.toContain('DIPLOMA');
    expect(codes).not.toContain('FOUNDATION');
  });

  it("gives a specialization its own ticks and courses only, not its subject's ticks", async () => {
    const { service } = fakeDb();
    const rows = await service.list(AI);
    expect(rows.map((row) => [row.level.code, row.sources])).toEqual([
      ['PG', ['COURSES']],
      ['PHD', ['TICKED']],
    ]);
  });

  it('is empty for a field offered at nothing yet', async () => {
    const { service } = fakeDb();
    await expect(
      service.list({ kind: 'subject', id: 'empty' }),
    ).resolves.toEqual([]);
  });

  it('still lists a written page whose level is no longer offered, after the offered ones', async () => {
    const { service, db } = fakeDb();
    db.pages.push({
      id: 'old',
      subjectId: 'cs',
      subSubjectId: null,
      scopeKey: '',
      courseLevelId: 'mba',
      intro: '<p>Old.</p>',
      admissionNote: null,
      careersNote: null,
      status: 'PUBLISHED',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const rows = await service.list(SUBJECT);
    expect(rows.at(-1)).toMatchObject({
      level: { code: 'MBA' },
      offered: false,
      sources: [],
      page: { id: 'old', status: 'PUBLISHED', hasIntro: true },
    });
  });

  it('addresses each page by the level’s readable slug', async () => {
    const { service } = fakeDb();
    expect(
      (await service.list(SUBJECT)).find((row) => row.level.code === 'PG')
        ?.path,
    ).toBe('/subjects/computer-science/masters');
    expect(
      (await service.list(AI)).find((row) => row.level.code === 'PG')?.path,
    ).toBe('/subjects/computer-science/artificial-intelligence/masters');
  });

  it('calls a page search-ready only when published with an intro and three live questions', async () => {
    const { service } = fakeDb();
    await service.upsert(
      SUBJECT,
      'ug',
      {
        intro: '<p>Why study it.</p>',
        faqs: [faq(1), faq(2), faq(3, 'INACTIVE')],
        status: 'PUBLISHED',
      },
      request,
    );
    const ready = async () =>
      (await service.list(SUBJECT)).find((row) => row.level.code === 'UG')
        ?.page;
    expect(await ready()).toMatchObject({ faqCount: 2, searchReady: false });
    await service.upsert(
      SUBJECT,
      'ug',
      { faqs: [faq(1), faq(2), faq(3)] },
      request,
    );
    expect(await ready()).toMatchObject({
      faqCount: 3,
      searchReady: true,
      hasSeo: false,
    });
    await service.upsert(SUBJECT, 'ug', { status: 'DRAFT' }, request);
    expect(await ready()).toMatchObject({ searchReady: false });
  });
});

describe('writing a level page for the first time', () => {
  it("files a subject's page under an empty scope and a specialization's under its id", async () => {
    const { service, db } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'Hello' }, request);
    await service.upsert(AI, 'phd', { intro: 'Hello' }, request);
    expect(
      db.pages.map(({ subjectId, subSubjectId, scopeKey, courseLevelId }) => ({
        subjectId,
        subSubjectId,
        scopeKey,
        courseLevelId,
      })),
    ).toEqual([
      {
        subjectId: 'cs',
        subSubjectId: null,
        scopeKey: '',
        courseLevelId: 'ug',
      },
      {
        subjectId: 'cs',
        subSubjectId: 'ai',
        scopeKey: 'ai',
        courseLevelId: 'phd',
      },
    ]);
    expect(db.pages.every((page) => page.status === 'DRAFT')).toBe(true);
  });

  it('sanitises what is written and stores a field with nothing visible as nothing', async () => {
    const { service } = fakeDb();
    const detail = await service.upsert(
      SUBJECT,
      'ug',
      {
        intro: '<p onclick="steal()">Hello<script>alert(1)</script></p>',
        admissionNote: '<p> </p>',
        careersNote: '<p><img src="/media/chart.png" alt="Pay"></p>',
        faqs: [
          {
            question: '<b>Is it hard?</b>',
            answer: '<p>Yes<script>x()</script></p>',
          },
        ],
      },
      request,
    );
    expect(detail.page).toMatchObject({
      intro: '<p>Hello</p>',
      admissionNote: null,
      careersNote: '<p><img src="/media/chart.png" alt="Pay"></p>',
      faqs: [
        { question: 'Is it hard?', answer: '<p>Yes</p>', status: 'ACTIVE' },
      ],
    });
  });

  it('orders the questions as sent, 0 to n-1, unless an order is given', async () => {
    const { service } = fakeDb();
    const detail = await service.upsert(
      SUBJECT,
      'ug',
      { faqs: [faq(1), faq(2), faq(3)] },
      request,
    );
    expect(
      detail.page?.faqs.map((row) => [row.question, row.displayOrder]),
    ).toEqual([
      ['Question 1?', 0],
      ['Question 2?', 1],
      ['Question 3?', 2],
    ]);
  });

  it('writes the page, its questions and its SEO in one transaction, and audits a create', async () => {
    const { service, calls, db } = fakeDb();
    const detail = await service.upsert(
      SUBJECT,
      'ug',
      {
        intro: 'Hello',
        faqs: [faq(1)],
        seo: { seoTitle: 'Study CS', metaDescription: 'Why.' },
        expectedUpdatedAt: null,
      },
      request,
    );
    expect(calls).toEqual(
      expect.arrayContaining([
        'subjectLevelPage.create (in transaction)',
        'subjectLevelPageFaq.createMany (in transaction)',
        'seoMetadata.upsert (in transaction)',
      ]),
    );
    expect(detail.page?.seo).toMatchObject({
      ownerType: 'SUBJECT_LEVEL_PAGE',
      ownerId: detail.page?.id,
      seoTitle: 'Study CS',
    });
    expect(db.audits).toEqual([
      expect.objectContaining({
        module: 'CATALOG',
        entityType: 'SUBJECT_LEVEL_PAGE',
        entityId: detail.page?.id,
        action: 'CREATE',
        newValues: expect.objectContaining({
          courseLevelCode: 'UG',
          status: 'DRAFT',
          faqs: 1,
          hasSeo: true,
        }),
      }),
    ]);
  });
});

describe('saving part of a level page', () => {
  async function written() {
    const fake = fakeDb();
    const first = await fake.service.upsert(
      SUBJECT,
      'ug',
      {
        intro: '<p>Intro.</p>',
        admissionNote: '<p>Admission.</p>',
        faqs: [faq(1), faq(2)],
        seo: { seoTitle: 'Study CS', metaDescription: 'Why.' },
      },
      request,
    );
    return { ...fake, first };
  }

  it('leaves a field left out as it is and clears one sent empty', async () => {
    const { service } = await written();
    const detail = await service.upsert(
      SUBJECT,
      'ug',
      { admissionNote: '' },
      request,
    );
    expect(detail.page).toMatchObject({
      intro: '<p>Intro.</p>',
      admissionNote: null,
    });
    expect(detail.page?.faqs).toHaveLength(2);
  });

  it('clears the questions when an empty list is sent', async () => {
    const { service } = await written();
    const detail = await service.upsert(SUBJECT, 'ug', { faqs: [] }, request);
    expect(detail.page?.faqs).toEqual([]);
  });

  it('removes the SEO for null and keeps it when left out', async () => {
    const { service } = await written();
    const kept = await service.upsert(SUBJECT, 'ug', { intro: 'New' }, request);
    expect(kept.page?.seo).toMatchObject({ seoTitle: 'Study CS' });
    const cleared = await service.upsert(SUBJECT, 'ug', { seo: null }, request);
    expect(cleared.page?.seo).toBeNull();
  });

  /* The editor leaves a field it cleared out of the SEO it sends. It used to
     be skipped by the update, so a stale canonical and image stayed on the
     public page. */
  it('replaces the SEO whole when sent, clearing a field left out', async () => {
    const { service } = await written();
    await service.upsert(
      SUBJECT,
      'ug',
      {
        seo: {
          seoTitle: 'Study CS',
          metaDescription: 'Why.',
          canonicalUrl: '/subjects/cs/masters-old',
          focusKeyword: 'kw',
          ogTitle: 'OG',
          ogMediaId: 'img-live',
          twitterMediaId: 'img-live',
        },
      },
      request,
    );
    const cleared = await service.upsert(
      SUBJECT,
      'ug',
      { seo: { seoTitle: 'Study CS', metaDescription: 'Why.', ogTitle: '' } },
      request,
    );
    expect(cleared.page?.seo).toMatchObject({
      seoTitle: 'Study CS',
      canonicalUrl: null,
      focusKeyword: null,
      ogTitle: null,
      ogMediaId: null,
      twitterMediaId: null,
    });
  });

  it('moves the version on when only the questions or only the SEO change', async () => {
    const { service, first, calls } = await written();
    const afterFaqs = await service.upsert(
      SUBJECT,
      'ug',
      { faqs: [faq(3)], expectedUpdatedAt: first.page?.updatedAt },
      request,
    );
    expect(afterFaqs.page?.updatedAt).not.toBe(first.page?.updatedAt);
    expect(calls).toContain(
      'subjectLevelPage.updateMany ["status"] (in transaction)',
    );
    const afterSeo = await service.upsert(
      SUBJECT,
      'ug',
      {
        seo: { seoTitle: 'Other', metaDescription: 'Other.' },
        expectedUpdatedAt: afterFaqs.page?.updatedAt,
      },
      request,
    );
    expect(afterSeo.page?.updatedAt).not.toBe(afterFaqs.page?.updatedAt);
  });

  it('audits an update with what the page was and is', async () => {
    const { service, db } = await written();
    await service.upsert(SUBJECT, 'ug', { status: 'PUBLISHED' }, request);
    expect(db.audits.at(-1)).toMatchObject({
      action: 'UPDATE',
      oldValues: { status: 'DRAFT', faqs: 2 },
      newValues: { status: 'PUBLISHED', faqs: 2, hasSeo: true },
    });
  });
});

describe('two editors on one level page', () => {
  it('refuses a version older than the page', async () => {
    const { service } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'B', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
  });

  it('refuses "no page yet" once somebody has written one', async () => {
    const { service } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'B', expectedUpdatedAt: null },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
  });

  it('refuses a version for a page deleted since', async () => {
    const { service } = fakeDb();
    const first = await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    await service.remove(SUBJECT, 'ug', {}, request);
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'B', expectedUpdatedAt: first.page?.updatedAt },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
  });

  it('turns two first saves at once into a stale version, not a server error', async () => {
    const { service, db } = fakeDb();
    db.failCreate = [{}];
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'B', expectedUpdatedAt: null },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
  });

  it('refuses a save when another lands between its check and its write', async () => {
    const { service, db, hooks } = fakeDb();
    const first = await service.upsert(
      SUBJECT,
      'ug',
      { intro: 'A', faqs: [faq(1)] },
      request,
    );
    hooks.beforeTransaction = () =>
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'Other', faqs: [faq(2)] },
        request,
      );
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { intro: 'B', faqs: [], expectedUpdatedAt: first.page?.updatedAt },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
    /* The save that landed keeps its words and its questions. */
    expect(db.pages[0].intro).toBe('Other');
    expect(db.faqs.map((row) => row.question)).toEqual(['Question 2?']);
  });

  it('lets one of two saves sent at once from one version through', async () => {
    const { service, db } = fakeDb();
    const first = await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    const results = await Promise.allSettled(
      ['B', 'C'].map((intro) =>
        service.upsert(
          SUBJECT,
          'ug',
          { intro, expectedUpdatedAt: first.page?.updatedAt },
          request,
        ),
      ),
    );
    const won = results.filter((result) => result.status === 'fulfilled');
    const lost = results.filter((result) => result.status === 'rejected');
    expect([won.length, lost.length]).toEqual([1, 1]);
    expect(lost[0].reason).toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
    expect(db.pages[0].intro).toBe(won[0].value.page?.intro);
  });

  it('checks nothing when no version is sent', async () => {
    const { service } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    await expect(
      service.upsert(SUBJECT, 'ug', { intro: 'B' }, request),
    ).resolves.toMatchObject({ page: { intro: 'B' } });
  });
});

describe('what a level page save refuses', () => {
  it('a first save at a level the field is not offered at', async () => {
    const { service } = fakeDb();
    await expect(
      service.upsert(SUBJECT, 'mba', { intro: 'A' }, request),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_LEVEL_NOT_OFFERED'));
  });

  it('nothing on a written page whose level was unticked since', async () => {
    const { service, db } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    db.subjectTicks = [];
    const detail = await service.upsert(SUBJECT, 'ug', { intro: 'B' }, request);
    expect(detail).toMatchObject({ offered: false, page: { intro: 'B' } });
  });

  it('finds a level by a v1 id and answers 404 for an unknown one', async () => {
    const { service, db } = fakeDb();
    db.courses.push({
      subjectId: 'cs',
      subSubjectId: null,
      courseLevelId: FOUNDATION_ID,
      status: 'PUBLISHED',
      deletedAt: null,
    });
    await expect(
      service.upsert(SUBJECT, FOUNDATION_ID, { intro: 'A' }, request),
    ).resolves.toMatchObject({ level: { code: 'FOUNDATION' } });
    await expect(service.get(SUBJECT, 'nope')).rejects.toMatchObject({
      response: { code: 'COURSE_LEVEL_NOT_FOUND' },
    });
  });

  it('answers a level that is not offered with its page, not a 404', async () => {
    const { service } = fakeDb();
    await expect(service.get(SUBJECT, 'mba')).resolves.toMatchObject({
      level: { code: 'MBA', slug: 'mba' },
      offered: false,
      sources: [],
      page: null,
    });
  });

  it('an unknown subject or specialization', async () => {
    const { service } = fakeDb();
    await expect(
      service.list({ kind: 'subject', id: 'nope' }),
    ).rejects.toMatchObject({ response: { code: 'SUBJECT_NOT_FOUND' } });
    await expect(
      service.list({ kind: 'specialization', id: 'nope' }),
    ).rejects.toMatchObject({ response: { code: 'SUB_SUBJECT_NOT_FOUND' } });
  });

  it('a question left empty once its tags are gone, saying which', async () => {
    const { service } = fakeDb();
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { faqs: [faq(1), { question: '<b></b>', answer: '<p>A</p>' }] },
        request,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: 'LEVEL_PAGE_INVALID', details: { index: 1 } },
    });
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { faqs: [{ question: 'Q?', answer: '<p> </p>' }] },
        request,
      ),
    ).rejects.toMatchObject({ response: { code: 'LEVEL_PAGE_INVALID' } });
  });

  it('publishing a page with nothing to show, with the reason', async () => {
    const { service } = fakeDb();
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { status: 'PUBLISHED', intro: '<p> </p>', faqs: [faq(1, 'INACTIVE')] },
        request,
      ),
    ).rejects.toMatchObject({
      status: 422,
      response: {
        code: 'LEVEL_PAGE_NOT_READY',
        details: [expect.objectContaining({ field: 'intro' })],
      },
    });
    /* A single live question is enough to publish. */
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { status: 'PUBLISHED', faqs: [faq(1)] },
        request,
      ),
    ).resolves.toMatchObject({ page: { status: 'PUBLISHED' } });
  });

  it('a script canonical, and accepts a path on this site', async () => {
    const { service } = fakeDb();
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        {
          seo: {
            seoTitle: 'T',
            metaDescription: 'D',
            canonicalUrl: 'javascript:alert(1)',
          },
        },
        request,
      ),
    ).rejects.toMatchObject(conflict('SEO_URL_INVALID'));
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        {
          seo: {
            seoTitle: 'T',
            metaDescription: 'D',
            canonicalUrl: '/subjects/computer-science',
          },
        },
        request,
      ),
    ).resolves.toMatchObject({
      page: { seo: { canonicalUrl: '/subjects/computer-science' } },
    });
  });

  it('an SEO image that is not a live image, and keeps a live one by id', async () => {
    const { service } = fakeDb();
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { seo: { seoTitle: 'T', metaDescription: 'D', ogMediaId: 'img-gone' } },
        request,
      ),
    ).rejects.toMatchObject(conflict('MEDIA_INVALID'));
    await expect(
      service.upsert(
        SUBJECT,
        'ug',
        { seo: { seoTitle: 'T', metaDescription: 'D', ogMediaId: 'img-live' } },
        request,
      ),
    ).resolves.toMatchObject({
      page: { seo: { ogMediaId: 'img-live', twitterMediaId: null } },
    });
  });
});

describe('deleting what was written for a level page', () => {
  it('removes the page and its SEO in one transaction, for good', async () => {
    const { service, calls, db } = fakeDb();
    const first = await service.upsert(
      SUBJECT,
      'ug',
      {
        intro: 'A',
        faqs: [faq(1)],
        seo: { seoTitle: 'T', metaDescription: 'D' },
      },
      request,
    );
    await expect(
      service.remove(
        SUBJECT,
        'ug',
        { expectedUpdatedAt: first.page?.updatedAt },
        request,
      ),
    ).resolves.toEqual({ deleted: true });
    expect(calls.slice(-3)).toEqual([
      '$transaction',
      'subjectLevelPage.deleteMany (in transaction)',
      `seoMetadata.deleteMany {"ownerType":"SUBJECT_LEVEL_PAGE","ownerId":"${first.page?.id}"} (in transaction)`,
    ]);
    expect([db.pages, db.faqs, db.seo]).toEqual([[], [], []]);
    expect(db.audits.at(-1)).toMatchObject({
      action: 'DELETE',
      newValues: { deleted: true, permanent: true },
    });
  });

  it('refuses a stale version', async () => {
    const { service } = fakeDb();
    await service.upsert(SUBJECT, 'ug', { intro: 'A' }, request);
    await expect(
      service.remove(
        SUBJECT,
        'ug',
        { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
  });

  it('refuses to delete a page saved again after its check, and keeps it', async () => {
    const { service, db, hooks } = fakeDb();
    const first = await service.upsert(
      SUBJECT,
      'ug',
      { intro: 'A', seo: { seoTitle: 'T', metaDescription: 'D' } },
      request,
    );
    hooks.beforeTransaction = () =>
      service.upsert(SUBJECT, 'ug', { intro: 'Other' }, request);
    await expect(
      service.remove(
        SUBJECT,
        'ug',
        { expectedUpdatedAt: first.page?.updatedAt },
        request,
      ),
    ).rejects.toMatchObject(conflict('LEVEL_PAGE_STALE_VERSION'));
    expect(db.pages.map((page) => page.intro)).toEqual(['Other']);
    expect(db.seo).toHaveLength(1);
  });

  it('reports nothing deleted when nothing was written', async () => {
    const { service } = fakeDb();
    await expect(service.remove(SUBJECT, 'ug', {}, request)).resolves.toEqual({
      deleted: false,
    });
  });
});

describe('the body a level page save accepts', () => {
  const errors = async (body: Record<string, unknown>) =>
    (
      await validate(plainToInstance(UpsertLevelPageDto, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).map((error) => error.property);

  it('takes null for the SEO and the version, and nothing at all', async () => {
    expect(await errors({ seo: null, expectedUpdatedAt: null })).toEqual([]);
    expect(await errors({})).toEqual([]);
  });

  it('refuses unknown keys inside the questions and the SEO', async () => {
    expect(
      await errors({ faqs: [{ id: 'x', question: 'Q', answer: 'A' }] }),
    ).toEqual(['faqs']);
    expect(
      await errors({
        seo: { seoTitle: 'T', metaDescription: 'D', expectedUpdatedAt: 'x' },
      }),
    ).toEqual(['seo']);
  });

  it('refuses a status other than draft or published, and null questions', async () => {
    expect(await errors({ status: 'ACTIVE' })).toEqual(['status']);
    expect(await errors({ faqs: null })).toEqual(['faqs']);
    expect(
      await errors({ faqs: Array.from({ length: 31 }, () => faq(1)) }),
    ).toEqual(['faqs']);
  });
});

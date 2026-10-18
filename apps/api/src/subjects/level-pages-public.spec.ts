import { SubjectLevelPagesService } from './level-pages.service';
import {
  levelPagePath,
  matchesLevelParam,
  publicLevelSlug,
  richTextOrNull,
} from './level-pages.shared';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * A study level's page as the website reads it -- the field, the level,
 * what an editor published and the SEO -- and the list of level pages the
 * sitemap may announce.
 */

type Row = Record<string, any>;

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
  description: code === 'PG' ? 'A year or two after a first degree.' : null,
  status,
  educationOrder,
  displayOrder: educationOrder,
});
const published = { status: 'PUBLISHED', deletedAt: null };

/**
 * Computer Science (published) with a published specialization AI and a
 * draft one, Data Science; a draft subject, Philosophy. Computer Science is
 * ticked for Bachelor's, AI for PhD, and AI teaches a Master's course.
 */
function fakeDb(seed: Partial<Record<string, Row[]>> = {}) {
  const db: Record<string, Row[]> = {
    levels: [
      level('ug', 'UG', "Bachelor's", 3),
      level('pg', 'PG', "Master's", 4),
      level('mba', 'MBA', 'MBA', 5),
      level('phd', 'PHD', 'PhD', 6),
      level('dip', 'DIPLOMA', 'Diploma', 7, 'INACTIVE'),
    ],
    subjects: [
      {
        id: 'cs',
        name: 'Computer Science',
        slug: 'computer-science',
        ...published,
      },
      {
        id: 'ph',
        name: 'Philosophy',
        slug: 'philosophy',
        status: 'DRAFT',
        deletedAt: null,
      },
    ],
    specializations: [
      {
        id: 'ai',
        subjectId: 'cs',
        name: 'Artificial Intelligence',
        slug: 'artificial-intelligence',
        ...published,
      },
      {
        id: 'ds',
        subjectId: 'cs',
        name: 'Data Science',
        slug: 'data-science',
        status: 'DRAFT',
        deletedAt: null,
      },
    ],
    subjectTicks: [{ subjectId: 'cs', courseLevelId: 'ug' }],
    specTicks: [
      { subSubjectId: 'ai', courseLevelId: 'phd' },
      { subSubjectId: 'ds', courseLevelId: 'mba' },
    ],
    courses: [
      {
        subjectId: 'cs',
        subSubjectId: 'ai',
        courseLevelId: 'pg',
        ...published,
      },
    ],
    pages: [],
    faqs: [],
    seo: [],
    templates: [],
    ...seed,
  };
  const live = (row: Row | undefined) =>
    !!row && row.status === 'PUBLISHED' && !row.deletedAt;
  const subjectBy = (where: any) =>
    db.subjects.find(
      (row) =>
        row.slug === where.slug &&
        where.status === row.status &&
        !row.deletedAt,
    );
  const prisma: Row = {
    subject: {
      findFirst: async ({ where }: Row) => {
        const row = subjectBy(where);
        return row ? { id: row.id, name: row.name, slug: row.slug } : null;
      },
    },
    subSubject: {
      findFirst: async ({ where }: Row) => {
        const parent = subjectBy(where.subject);
        const row = db.specializations.find(
          (spec) =>
            spec.subjectId === parent?.id &&
            spec.slug === where.slug &&
            spec.status === where.status &&
            !spec.deletedAt,
        );
        return row ? { id: row.id, name: row.name, slug: row.slug } : null;
      },
    },
    courseLevel: {
      findMany: async ({ where }: Row) =>
        db.levels.filter((row) => row.status === where.status),
    },
    subjectLevelPage: {
      findUnique: async ({ where, include }: Row) => {
        const key = where.subjectId_scopeKey_courseLevelId;
        const page = db.pages.find(
          (row) =>
            row.subjectId === key.subjectId &&
            row.scopeKey === key.scopeKey &&
            row.courseLevelId === key.courseLevelId,
        );
        if (!page) return null;
        return {
          ...page,
          faqs: db.faqs
            .filter(
              (faq) =>
                faq.pageId === page.id &&
                faq.status === include.faqs.where.status,
            )
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(({ id, question, answer }) => ({ id, question, answer })),
        };
      },
      /* The sitemap's read: published pages under a published subject and
         specialization, at a level switched on. */
      findMany: async ({ where }: Row) =>
        db.pages
          .filter(
            (page) =>
              page.status === where.status &&
              live(db.subjects.find((row) => row.id === page.subjectId)) &&
              db.levels.find((row) => row.id === page.courseLevelId)?.status ===
                'ACTIVE' &&
              (page.subSubjectId === null ||
                live(
                  db.specializations.find(
                    (row) => row.id === page.subSubjectId,
                  ),
                )) &&
              (!where.intro || page.intro !== null),
          )
          .map((page) => ({
            ...page,
            subject: db.subjects.find((row) => row.id === page.subjectId),
            subSubject:
              db.specializations.find((row) => row.id === page.subSubjectId) ??
              null,
            courseLevel: db.levels.find((row) => row.id === page.courseLevelId),
            _count: {
              faqs: db.faqs.filter(
                (faq) => faq.pageId === page.id && faq.status === 'ACTIVE',
              ).length,
            },
          })),
    },
    subjectCourseLevel: { findMany: async () => db.subjectTicks },
    subSubjectCourseLevel: {
      findMany: async () =>
        db.specTicks
          .map((tick) => ({
            ...tick,
            subSubject: db.specializations.find(
              (row) => row.id === tick.subSubjectId,
            ),
          }))
          .filter((tick) => live(tick.subSubject)),
    },
    course: {
      groupBy: async () =>
        db.courses
          .filter(live)
          .map(({ subjectId, subSubjectId, courseLevelId }) => ({
            subjectId,
            subSubjectId,
            courseLevelId,
          })),
    },
    seoMetadata: {
      findUnique: async ({ where }: Row) => {
        const key = where.ownerType_ownerId;
        const row = db.seo.find(
          (seo) =>
            seo.ownerType === key.ownerType && seo.ownerId === key.ownerId,
        );
        return row ? { ...row, ogMedia: null, twitterMedia: null } : null;
      },
      findMany: async ({ where }: Row) =>
        db.seo.filter(
          (row) =>
            row.ownerType === where.ownerType &&
            where.ownerId.in.includes(row.ownerId),
        ),
    },
    seoBulkTemplate: {
      findUnique: async ({ where }: Row) =>
        db.templates.find((row) => row.entityType === where.entityType) ?? null,
    },
  };
  const resolve = jest.fn(
    async (_type: string, record: Row, manual: Row | null | undefined) => ({
      seoTitle: manual?.seoTitle ?? record.name,
      source: { title: manual?.seoTitle ? 'manual' : 'fallback' },
    }),
  );
  return {
    db,
    resolve,
    service: new SubjectLevelPagesService(prisma as unknown as PrismaService, {
      resolve,
    }),
  };
}

function writePage(
  db: Record<string, Row[]>,
  page: Partial<Row> & { id: string; courseLevelId: string },
  faqs: Array<{ status: string; displayOrder?: number }> = [],
) {
  db.pages.push({
    subjectId: 'cs',
    subSubjectId: null,
    scopeKey: '',
    intro: '<p>Why study it.</p>',
    admissionNote: null,
    careersNote: null,
    industries: null,
    employers: null,
    lookingAhead: null,
    status: 'PUBLISHED',
    updatedAt: new Date('2026-10-17T10:00:00.000Z'),
    ...page,
  });
  faqs.forEach((faq, index) =>
    db.faqs.push({
      id: `${page.id}-faq-${index}`,
      pageId: page.id,
      question: `Question ${index + 1}?`,
      answer: `<p>Answer ${index + 1}.</p>`,
      displayOrder: faq.displayOrder ?? index,
      status: faq.status,
    }),
  );
}
const active = (n: number) =>
  Array.from({ length: n }, () => ({ status: 'ACTIVE' }));

describe("a level page's address", () => {
  it('matches a level by its code, its readable slug or "undergraduate"', () => {
    const ug = { code: 'UG' };
    expect(matchesLevelParam(ug, 'UG')).toBe(true);
    expect(matchesLevelParam(ug, 'ug')).toBe(true);
    expect(matchesLevelParam(ug, 'bachelors')).toBe(true);
    expect(matchesLevelParam(ug, 'undergraduate')).toBe(true);
    expect(matchesLevelParam(ug, 'masters')).toBe(false);
    expect(matchesLevelParam({ code: 'DIPLOMA' }, 'diploma')).toBe(true);
  });

  it('is built from the readable slug, any other level by its code', () => {
    expect(publicLevelSlug('PG')).toBe('masters');
    expect(publicLevelSlug('DIPLOMA')).toBe('diploma');
    expect(
      levelPagePath({ subjectSlug: 'computer-science', levelCode: 'PG' }),
    ).toBe('/subjects/computer-science/masters');
    expect(
      levelPagePath({
        subjectSlug: 'computer-science',
        specializationSlug: 'artificial-intelligence',
        levelCode: 'PHD',
      }),
    ).toBe('/subjects/computer-science/artificial-intelligence/phd');
  });

  it('stores rich text with nothing visible as nothing, a picture as something', () => {
    expect(richTextOrNull('<p> </p>')).toBeNull();
    expect(richTextOrNull('<p>&nbsp;<br></p>')).toBeNull();
    expect(richTextOrNull('')).toBeNull();
    expect(richTextOrNull(undefined)).toBeNull();
    expect(richTextOrNull('<p><img src="/media/a.png" alt=""></p>')).toBe(
      '<p><img src="/media/a.png" alt=""></p>',
    );
  });
});

describe("a level page's public record", () => {
  it('finds the level by code, readable slug or alias', async () => {
    const { service } = fakeDb();
    for (const value of ['PG', 'masters', 'Masters'])
      await expect(
        service.publicPage('computer-science', value),
      ).resolves.toMatchObject({
        level: {
          code: 'PG',
          slug: 'masters',
          description: 'A year or two after a first degree.',
        },
      });
    await expect(
      service.publicPage('computer-science', 'undergraduate'),
    ).resolves.toMatchObject({ level: { code: 'UG' } });
  });

  it('answers 404 for an unknown or switched-off level, a draft subject and a draft specialization', async () => {
    const { service } = fakeDb();
    await expect(
      service.publicPage('computer-science', 'nope'),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_NOT_FOUND' } });
    await expect(
      service.publicPage('computer-science', 'diploma'),
    ).rejects.toMatchObject({ response: { code: 'COURSE_LEVEL_NOT_FOUND' } });
    await expect(
      service.publicPage('philosophy', 'masters'),
    ).rejects.toMatchObject({ response: { code: 'SUBJECT_NOT_FOUND' } });
    await expect(
      service.publicPage('computer-science', 'masters', 'data-science'),
    ).rejects.toMatchObject({
      response: { code: 'SPECIALIZATION_NOT_FOUND' },
    });
  });

  it('does not decide whether the field is offered at the level', async () => {
    /* The website owns that 404; MBA is offered nowhere here. */
    const { service } = fakeDb();
    await expect(
      service.publicPage('computer-science', 'mba'),
    ).resolves.toMatchObject({ level: { code: 'MBA' }, content: null });
  });

  it('shows nothing of a draft page, its SEO included', async () => {
    const { service, db, resolve } = fakeDb();
    writePage(
      db,
      { id: 'p1', courseLevelId: 'pg', status: 'DRAFT' },
      active(3),
    );
    db.seo.push({
      ownerType: 'SUBJECT_LEVEL_PAGE',
      ownerId: 'p1',
      seoTitle: 'Draft title',
    });
    const result = await service.publicPage('computer-science', 'masters');
    expect(result).toMatchObject({ content: null, hasOwnContent: false });
    expect(resolve).toHaveBeenCalledWith(
      'levelPage',
      expect.objectContaining({ name: "Master's in Computer Science" }),
      null,
    );
  });

  it("sends a published page's live questions in order and its own SEO to the resolver", async () => {
    const { service, db, resolve } = fakeDb();
    writePage(db, { id: 'p1', courseLevelId: 'pg' }, [
      { status: 'ACTIVE', displayOrder: 2 },
      { status: 'INACTIVE', displayOrder: 0 },
      { status: 'ACTIVE', displayOrder: 1 },
    ]);
    db.seo.push({
      ownerType: 'SUBJECT_LEVEL_PAGE',
      ownerId: 'p1',
      seoTitle: 'Study a CS master’s abroad',
    });
    const result = await service.publicPage('computer-science', 'PG');
    expect(result.content?.faqs.map((faq) => faq.question)).toEqual([
      'Question 3?',
      'Question 1?',
    ]);
    expect(result.seo).toMatchObject({
      seoTitle: 'Study a CS master’s abroad',
    });
    expect(resolve.mock.calls[0][1]).toMatchObject({
      id: 'p1',
      levelSlug: 'masters',
      subject: { name: 'Computer Science', slug: 'computer-science' },
      specialization: null,
      courseLevel: { name: "Master's", code: 'PG' },
    });
  });

  it("reads a specialization's own page, not its subject's", async () => {
    const { service, db, resolve } = fakeDb();
    writePage(db, { id: 'subject-page', courseLevelId: 'phd' });
    writePage(db, {
      id: 'ai-page',
      courseLevelId: 'phd',
      subSubjectId: 'ai',
      scopeKey: 'ai',
      intro: '<p>AI research.</p>',
    });
    const result = await service.publicPage(
      'computer-science',
      'phd',
      'artificial-intelligence',
    );
    expect(result).toMatchObject({
      specialization: { slug: 'artificial-intelligence' },
      content: { id: 'ai-page', intro: '<p>AI research.</p>' },
    });
    expect(resolve.mock.calls[0][1]).toMatchObject({
      name: 'PhD in Artificial Intelligence',
      specialization: { slug: 'artificial-intelligence' },
    });
  });

  it('has its own content only with an intro and three live questions', async () => {
    const cases: Array<[string | null, number, boolean]> = [
      ['<p>Intro.</p>', 3, true],
      ['<p>Intro.</p>', 2, false],
      [null, 3, false],
    ];
    for (const [intro, questions, expected] of cases) {
      const { service, db } = fakeDb();
      writePage(
        db,
        { id: 'p1', courseLevelId: 'pg', intro },
        active(questions),
      );
      expect(
        (await service.publicPage('computer-science', 'masters')).hasOwnContent,
      ).toBe(expected);
    }
  });

  const sections = {
    industries: '<p>Software and finance.</p>',
    employers: '<p>Banks and studios.</p>',
    lookingAhead: '<p>Demand keeps growing.</p>',
  };

  it("sends a published page's new sections", async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'p1', courseLevelId: 'pg', ...sections });
    expect(
      (await service.publicPage('computer-science', 'masters')).content,
    ).toMatchObject({ id: 'p1', ...sections });
  });

  it('sends the new sections as null when nothing is written', async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'p1', courseLevelId: 'pg' });
    expect(
      (await service.publicPage('computer-science', 'masters')).content,
    ).toMatchObject({ industries: null, employers: null, lookingAhead: null });
  });

  it('shows nothing of the new sections of a draft', async () => {
    const { service, db } = fakeDb();
    writePage(db, {
      id: 'p1',
      courseLevelId: 'pg',
      status: 'DRAFT',
      ...sections,
    });
    expect(
      (await service.publicPage('computer-science', 'masters')).content,
    ).toBeNull();
  });

  it('has no own content on the new sections alone', async () => {
    const { service, db } = fakeDb();
    writePage(
      db,
      { id: 'p1', courseLevelId: 'pg', intro: null, ...sections },
      active(3),
    );
    expect(
      (await service.publicPage('computer-science', 'masters')).hasOwnContent,
    ).toBe(false);
  });
});

describe('the level pages the sitemap may list', () => {
  it('lists published pages at a level the field is still offered at, by path', async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'ug', courseLevelId: 'ug' }, active(3));
    writePage(db, {
      id: 'ai-phd',
      courseLevelId: 'phd',
      subSubjectId: 'ai',
      scopeKey: 'ai',
    });
    /* Left out: a draft page, one at a level offered nowhere, one under a
       draft specialization, and one at a switched-off level. */
    writePage(db, { id: 'draft', courseLevelId: 'pg', status: 'DRAFT' });
    writePage(db, { id: 'mba', courseLevelId: 'mba' });
    writePage(db, {
      id: 'ds-mba',
      courseLevelId: 'mba',
      subSubjectId: 'ds',
      scopeKey: 'ds',
    });
    writePage(db, { id: 'dip', courseLevelId: 'dip' });
    const result = await service.publicIndex();
    expect(result.data.map((row) => row.path)).toEqual([
      '/subjects/computer-science/artificial-intelligence/phd',
      '/subjects/computer-science/bachelors',
    ]);
    expect(result.data[1]).toMatchObject({
      subjectSlug: 'computer-science',
      specializationSlug: null,
      levelCode: 'UG',
      levelSlug: 'bachelors',
      hasOwnContent: true,
      updatedAt: '2026-10-17T10:00:00.000Z',
    });
    expect(result.data[0].hasOwnContent).toBe(false);
    expect(result.total).toBe(2);
  });

  it('does not count the new sections towards search', async () => {
    const { service, db } = fakeDb();
    writePage(
      db,
      {
        id: 'ug',
        courseLevelId: 'ug',
        intro: null,
        industries: '<p>Software.</p>',
        employers: '<p>Banks.</p>',
        lookingAhead: '<p>Growing.</p>',
      },
      active(3),
    );
    const result = await service.publicIndex();
    expect(result.data.map((row) => [row.path, row.hasOwnContent])).toEqual([
      ['/subjects/computer-science/bachelors', false],
    ]);
  });

  it('drops a page once its level is unticked and no course stands there', async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'ug', courseLevelId: 'ug' });
    db.subjectTicks = [];
    await expect(service.publicIndex()).resolves.toMatchObject({ data: [] });
  });

  it("takes each page's robots setting from its own SEO, else the template", async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'ug', courseLevelId: 'ug' });
    writePage(db, { id: 'pg', courseLevelId: 'pg' });
    db.seo.push({
      ownerType: 'SUBJECT_LEVEL_PAGE',
      ownerId: 'pg',
      robotsIndex: true,
    });
    db.templates.push({ entityType: 'levelPage', robotsIndex: false });
    const result = await service.publicIndex();
    expect(result.data.map((row) => [row.levelCode, row.robotsIndex])).toEqual([
      ['UG', false],
      ['PG', true],
    ]);
    expect(result.templateRobotsIndex).toBe(false);
  });

  it('says nothing about robots when neither the page nor a template does', async () => {
    const { service, db } = fakeDb();
    writePage(db, { id: 'ug', courseLevelId: 'ug' });
    const result = await service.publicIndex();
    expect(result.data[0].robotsIndex).toBeNull();
    expect(result.templateRobotsIndex).toBeNull();
  });
});

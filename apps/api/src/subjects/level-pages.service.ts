import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SEO_MANAGEMENT_RESOLVER } from '../seo-management/seo-management.tokens';
import type { SeoResolver } from '../seo-management/seo-management.types';
import {
  catalogBadRequest,
  catalogConflict,
  catalogNotFound,
  catalogNotReady,
} from '../catalog/catalog.errors';
import { isUniqueConstraintError } from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { byEducationOrder } from './public-order';
import {
  LEVEL_SOURCES,
  SUBJECT_LEVEL_PAGE_SEO_OWNER,
  hasOwnContent,
  levelPagePath,
  levelPageSeoRecord,
  matchesLevelParam,
  publicLevelSlug,
  richTextOrNull,
  type LevelSource,
} from './level-pages.shared';
import {
  MEDIA_SELECT,
  actorId,
  assertActiveImages,
  seoData,
  toSeo,
  validUrl,
} from './subjects.shared';
import type { SubjectActionDto } from './dto/subject.dto';
import type { UpsertLevelPageDto } from './dto/level-page.dto';

/** Whose level pages: a subject's own, or one of its specializations'. */
export type LevelPageOwner =
  { kind: 'subject'; id: string } | { kind: 'specialization'; id: string };

type Named = { id: string; name: string; slug: string; status: string };
type ResolvedOwner = {
  subject: Named;
  specialization: Named | null;
  /* Every page of this owner, and with a level id the one page. */
  key: { subjectId: string; scopeKey: string };
};

const LEVEL_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  educationOrder: true,
  displayOrder: true,
} as const;
type LevelRow = Prisma.CourseLevelGetPayload<{ select: typeof LEVEL_SELECT }>;
/* Every level by id, and why the field is offered at the ones it is. */
type Offered = {
  levels: Map<string, LevelRow>;
  sources: Map<string, Set<LevelSource>>;
};

const PUBLISHED = { status: 'PUBLISHED', deletedAt: null } as const;
const STALE_MESSAGE =
  'This level page changed in another session. Reload before saving';

/* The live questions, in the order an editor set. */
const FAQ_ORDER = [
  { displayOrder: 'asc' },
  { id: 'asc' },
] satisfies Prisma.SubjectLevelPageFaqOrderByWithRelationInput[];

/**
 * A study level's own page within a subject or a specialization --
 * /subjects/computing/masters, /subjects/computing/ai/masters -- and what an
 * editor writes for it: an intro, an admission note, a careers note, its
 * questions and its SEO, saved together under one version.
 *
 * Which levels a field has a page at is worked out here, the same way the
 * website works it out (apps/web course-levels.ts): a subject is offered at
 * what is ticked on it, on its published specializations, and where its
 * published courses stand; a specialization at its own ticks and its own
 * courses' levels. Only levels still switched on count. If the two sides
 * drift, the admin offers a page the site answers with a 404.
 */
@Injectable()
export class SubjectLevelPagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEO_MANAGEMENT_RESOLVER)
    private readonly seoManagement?: SeoResolver,
  ) {}

  /** One row per level the field is offered at, and one per written page
   * whose level it is no longer offered at, so that page can still be
   * opened or deleted. Offered rows first, each group in climbing order. */
  async list(owner: LevelPageOwner) {
    const resolved = await this.resolveOwner(owner);
    const [{ levels, sources }, pages] = await Promise.all([
      this.offered(resolved),
      this.prisma.subjectLevelPage.findMany({
        where: resolved.key,
        include: {
          _count: { select: { faqs: { where: { status: 'ACTIVE' } } } },
        },
      }),
    ]);
    const withSeo = new Set(
      pages.length
        ? (
            await this.prisma.seoMetadata.findMany({
              where: {
                ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
                ownerId: { in: pages.map((page) => page.id) },
              },
              select: { ownerId: true },
            })
          ).map((row) => row.ownerId)
        : [],
    );
    const byLevel = new Map(pages.map((page) => [page.courseLevelId, page]));
    const ids = new Set([...sources.keys(), ...byLevel.keys()]);
    return [...ids]
      .flatMap((id) => {
        const level = levels.get(id);
        return level ? [level] : [];
      })
      .sort(
        (a, b) =>
          Number(sources.has(b.id)) - Number(sources.has(a.id)) ||
          byEducationOrder(a, b),
      )
      .map((level) => {
        const page = byLevel.get(level.id) ?? null;
        return {
          level: this.levelRef(level),
          offered: sources.has(level.id),
          sources: this.sourceList(sources.get(level.id)),
          path: this.path(resolved, level),
          page: page
            ? {
                id: page.id,
                status: page.status,
                hasIntro: page.intro !== null,
                hasAdmissionNote: page.admissionNote !== null,
                hasCareersNote: page.careersNote !== null,
                faqCount: page._count.faqs,
                hasSeo: withSeo.has(page.id),
                searchReady: hasOwnContent({
                  status: page.status,
                  hasIntro: page.intro !== null,
                  activeFaqCount: page._count.faqs,
                }),
                updatedAt: page.updatedAt.toISOString(),
              }
            : null,
        };
      });
  }

  /** The page at one level, written or not. A level the field is not
   * offered at answers too, so the editor can say why it cannot be saved;
   * only a level that does not exist is a 404. */
  async get(owner: LevelPageOwner, courseLevelId: string) {
    const resolved = await this.resolveOwner(owner);
    return this.detail(resolved, courseLevelId, await this.offered(resolved));
  }

  async upsert(
    owner: LevelPageOwner,
    courseLevelId: string,
    dto: UpsertLevelPageDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const resolved = await this.resolveOwner(owner);
    const [offered, current] = await Promise.all([
      this.offered(resolved),
      this.prisma.subjectLevelPage.findUnique({
        where: this.pageKey(resolved, courseLevelId),
        include: { faqs: { select: { status: true } } },
      }),
    ]);
    const { levels, sources } = offered;
    const level = levels.get(courseLevelId);
    if (!level)
      throw catalogNotFound('COURSE_LEVEL_NOT_FOUND', 'Course level not found');
    this.checkVersion(current, dto.expectedUpdatedAt);
    /* A page is written for a level the field is offered at. One already
       written stays editable after its level is unticked, so its words can
       still be fixed or moved to draft. */
    if (!current && !sources.has(courseLevelId))
      throw catalogConflict(
        'LEVEL_PAGE_LEVEL_NOT_OFFERED',
        'This field is not offered at this study level. Tick the level or publish a course at it first',
      );

    const faqs = dto.faqs?.map((faq, index) => {
      /* A question is plain text; an answer is rich text, sanitised as a
         country's FAQ answers are. */
      const question = faq.question.replace(/<[^>]*>/g, '').trim();
      const answer = richTextOrNull(faq.answer);
      if (!question || !answer)
        throw catalogBadRequest(
          'LEVEL_PAGE_INVALID',
          `Question ${index + 1} needs a question and an answer`,
          { index },
        );
      return {
        question,
        answer,
        status: faq.status ?? 'ACTIVE',
        displayOrder: faq.displayOrder ?? index,
      };
    });
    if (dto.seo) {
      if (!validUrl(dto.seo.canonicalUrl))
        throw catalogConflict(
          'SEO_URL_INVALID',
          'Canonical URL must be a site path beginning with / or an http(s) URL',
        );
      await assertActiveImages(this.prisma, [
        dto.seo.ogMediaId,
        dto.seo.twitterMediaId,
      ]);
    }

    /* `status` is always written, so the page's updatedAt moves on every
       save -- also one that changed only the questions or the SEO -- and
       one version covers all of it. */
    const data = {
      ...(dto.intro !== undefined ? { intro: richTextOrNull(dto.intro) } : {}),
      ...(dto.admissionNote !== undefined
        ? { admissionNote: richTextOrNull(dto.admissionNote) }
        : {}),
      ...(dto.careersNote !== undefined
        ? { careersNote: richTextOrNull(dto.careersNote) }
        : {}),
      status: dto.status ?? current?.status ?? 'DRAFT',
    };
    /* Published means something shows: checked on the page as it will be
       once this save lands, the parts not sent as they are now. */
    if (data.status === 'PUBLISHED') {
      const kept = <K extends 'intro' | 'admissionNote' | 'careersNote'>(
        key: K,
      ) => (key in data ? data[key] : current?.[key]) ?? null;
      const liveFaqs = (faqs ?? current?.faqs ?? []) as Array<{
        status: string;
      }>;
      if (
        !kept('intro') &&
        !kept('admissionNote') &&
        !kept('careersNote') &&
        !liveFaqs.some((faq) => faq.status === 'ACTIVE')
      )
        throw catalogNotReady(
          'LEVEL_PAGE_NOT_READY',
          'Write an intro, a note or an FAQ before publishing this level page',
          [
            {
              field: 'intro',
              message:
                'Write an intro, an admission note, a careers note or a question first',
            },
          ],
        );
    }

    let page: { id: string };
    try {
      page = await this.prisma.$transaction(async (tx) => {
        /* Written only while the page is still the one read and checked
           above: two saves that both passed the check would otherwise both
           land, the second over the first, its questions gone. */
        let row: { id: string };
        if (current) {
          const updated = await tx.subjectLevelPage.updateMany({
            where: { id: current.id, updatedAt: current.updatedAt },
            data,
          });
          if (updated.count !== 1)
            throw catalogConflict('LEVEL_PAGE_STALE_VERSION', STALE_MESSAGE);
          row = { id: current.id };
        } else
          row = await tx.subjectLevelPage.create({
            data: {
              subjectId: resolved.key.subjectId,
              subSubjectId: resolved.specialization?.id ?? null,
              scopeKey: resolved.key.scopeKey,
              courseLevelId,
              ...data,
            },
          });
        /* The questions are sent whole and replace what was there. */
        if (faqs !== undefined) {
          await tx.subjectLevelPageFaq.deleteMany({
            where: { pageId: row.id },
          });
          if (faqs.length)
            await tx.subjectLevelPageFaq.createMany({
              data: faqs.map((faq) => ({ pageId: row.id, ...faq })),
            });
        }
        const seoKey = {
          ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
          ownerId: row.id,
        };
        if (dto.seo === null)
          await tx.seoMetadata.deleteMany({ where: seoKey });
        else if (dto.seo)
          await tx.seoMetadata.upsert({
            where: { ownerType_ownerId: seoKey },
            create: seoData(row.id, SUBJECT_LEVEL_PAGE_SEO_OWNER, dto.seo),
            update: seoData(row.id, SUBJECT_LEVEL_PAGE_SEO_OWNER, dto.seo),
          });
        return row;
      });
    } catch (error) {
      /* Two first saves of the same page at once: the second finds the row
         the first just made. */
      if (isUniqueConstraintError(error))
        throw catalogConflict('LEVEL_PAGE_STALE_VERSION', STALE_MESSAGE);
      throw error;
    }

    const detail = await this.detail(resolved, courseLevelId, offered);
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT_LEVEL_PAGE',
      page.id,
      current ? 'UPDATE' : 'CREATE',
      current
        ? this.summary(resolved, level, current, current.faqs.length)
        : null,
      detail.page
        ? {
            ...this.summary(
              resolved,
              level,
              detail.page,
              detail.page.faqs.length,
            ),
            hasSeo: detail.page.seo !== null,
          }
        : null,
      current ? 'Level page updated' : 'Level page created',
    );
    return detail;
  }

  /** Deletes what was written for the page, with its questions and its
   * SEO, for good; the level page itself stays, worked out from the
   * catalogue as before anything was written. */
  async remove(
    owner: LevelPageOwner,
    courseLevelId: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const resolved = await this.resolveOwner(owner);
    const [level, current] = await Promise.all([
      this.prisma.courseLevel.findUnique({
        where: { id: courseLevelId },
        select: LEVEL_SELECT,
      }),
      this.prisma.subjectLevelPage.findUnique({
        where: this.pageKey(resolved, courseLevelId),
        include: { _count: { select: { faqs: true } } },
      }),
    ]);
    if (!level)
      throw catalogNotFound('COURSE_LEVEL_NOT_FOUND', 'Course level not found');
    if (!current) return { deleted: false };
    this.checkVersion(current, dto.expectedUpdatedAt);
    /* The page goes only if it is still the one checked, so a save that
       landed in between is not deleted unseen. The SEO row has no foreign
       key; the questions go with the page. */
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.subjectLevelPage.deleteMany({
        where: { id: current.id, updatedAt: current.updatedAt },
      });
      if (deleted.count !== 1)
        throw catalogConflict('LEVEL_PAGE_STALE_VERSION', STALE_MESSAGE);
      await tx.seoMetadata.deleteMany({
        where: {
          ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
          ownerId: current.id,
        },
      });
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT_LEVEL_PAGE',
      current.id,
      'DELETE',
      this.summary(resolved, level, current, current._count.faqs),
      { deleted: true, permanent: true },
      'Level page deleted permanently',
    );
    return { deleted: true };
  }

  /**
   * A level page as the website reads it: the field and the level, what an
   * editor wrote when it is published, and its SEO resolved -- the page's
   * own, else the "Study level pages" bulk template, else the fallback.
   *
   * `level` is a code ("PG"), a readable slug ("masters") or "undergraduate".
   * Whether the field is offered at the level is not checked here: the
   * website decides which level pages exist and answers the rest with a 404.
   */
  async publicPage(
    subjectSlug: string,
    level: string,
    specializationSlug?: string,
  ) {
    const [subject, specialization, levels] = await Promise.all([
      this.prisma.subject.findFirst({
        where: { slug: subjectSlug.trim().toLowerCase(), ...PUBLISHED },
        select: { id: true, name: true, slug: true },
      }),
      specializationSlug
        ? this.prisma.subSubject.findFirst({
            where: {
              slug: specializationSlug.trim().toLowerCase(),
              ...PUBLISHED,
              subject: {
                slug: subjectSlug.trim().toLowerCase(),
                ...PUBLISHED,
              },
            },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve(null),
      this.prisma.courseLevel.findMany({
        where: { status: 'ACTIVE' },
        select: LEVEL_SELECT,
        orderBy: [{ educationOrder: 'asc' }, { displayOrder: 'asc' }],
      }),
    ]);
    if (!subject)
      throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    if (specializationSlug && !specialization)
      throw catalogNotFound(
        'SPECIALIZATION_NOT_FOUND',
        'Specialization not found',
      );
    const levelRow = levels.find((row) => matchesLevelParam(row, level));
    if (!levelRow)
      throw catalogNotFound('COURSE_LEVEL_NOT_FOUND', 'Course level not found');

    const row = await this.prisma.subjectLevelPage.findUnique({
      where: {
        subjectId_scopeKey_courseLevelId: {
          subjectId: subject.id,
          scopeKey: specialization?.id ?? '',
          courseLevelId: levelRow.id,
        },
      },
      include: {
        faqs: {
          where: { status: 'ACTIVE' },
          orderBy: FAQ_ORDER,
          select: { id: true, question: true, answer: true },
        },
      },
    });
    /* A draft is the editor's alone: neither its words nor its SEO show. */
    const page = row?.status === 'PUBLISHED' ? row : null;
    const seoRow = page
      ? await this.prisma.seoMetadata.findUnique({
          where: {
            ownerType_ownerId: {
              ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
              ownerId: page.id,
            },
          },
          include: {
            ogMedia: { select: MEDIA_SELECT },
            twitterMedia: { select: MEDIA_SELECT },
          },
        })
      : null;
    const record = levelPageSeoRecord({
      pageId: page?.id ?? null,
      subject,
      specialization,
      level: levelRow,
    });
    return {
      subject,
      specialization,
      level: {
        id: levelRow.id,
        code: levelRow.code,
        name: levelRow.name,
        slug: publicLevelSlug(levelRow.code),
        description: levelRow.description,
      },
      content: page
        ? {
            id: page.id,
            intro: page.intro,
            admissionNote: page.admissionNote,
            careersNote: page.careersNote,
            faqs: page.faqs,
            updatedAt: page.updatedAt.toISOString(),
          }
        : null,
      hasOwnContent: page
        ? hasOwnContent({
            status: page.status,
            hasIntro: page.intro !== null,
            activeFaqCount: page.faqs.length,
          })
        : false,
      seo: this.seoManagement
        ? await this.seoManagement.resolve('levelPage', record, toSeo(seoRow))
        : toSeo(seoRow),
    };
  }

  /**
   * Every published level page the sitemap may list: under a published
   * subject (and published specialization), at a level switched on that the
   * field is still offered at. Each says whether its own words are enough
   * for search and what its robots setting is -- the page's own SEO, else
   * the bulk template's (`templateRobotsIndex`, also for pages nobody
   * wrote). A handful of queries for the whole catalogue.
   */
  async publicIndex() {
    const where = {
      status: 'PUBLISHED',
      subject: PUBLISHED,
      courseLevel: { status: 'ACTIVE' },
      OR: [{ subSubjectId: null }, { subSubject: PUBLISHED }],
    } satisfies Prisma.SubjectLevelPageWhereInput;
    const [pages, withIntro, offered, template] = await Promise.all([
      this.prisma.subjectLevelPage.findMany({
        where,
        select: {
          id: true,
          subjectId: true,
          subSubjectId: true,
          status: true,
          updatedAt: true,
          subject: { select: { slug: true } },
          subSubject: { select: { slug: true } },
          courseLevel: { select: { id: true, code: true } },
          _count: { select: { faqs: { where: { status: 'ACTIVE' } } } },
        },
        take: 5000,
      }),
      /* Which have an intro, without reading every intro in. */
      this.prisma.subjectLevelPage.findMany({
        where: { ...where, intro: { not: null } },
        select: { id: true },
        take: 5000,
      }),
      this.catalogueOffered(),
      this.prisma.seoBulkTemplate.findUnique({
        where: { entityType: 'levelPage' },
        select: { robotsIndex: true },
      }),
    ]);
    const live = pages.filter((page) =>
      (page.subSubjectId
        ? offered.bySpecialization.get(page.subSubjectId)
        : offered.bySubject.get(page.subjectId)
      )?.has(page.courseLevel.id),
    );
    const robots = new Map(
      live.length
        ? (
            await this.prisma.seoMetadata.findMany({
              where: {
                ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
                ownerId: { in: live.map((page) => page.id) },
              },
              select: { ownerId: true, robotsIndex: true },
            })
          ).map((row) => [row.ownerId, row.robotsIndex])
        : [],
    );
    const introduced = new Set(withIntro.map((page) => page.id));
    const templateRobotsIndex =
      typeof template?.robotsIndex === 'boolean' ? template.robotsIndex : null;
    const data = live
      .map((page) => ({
        path: levelPagePath({
          subjectSlug: page.subject.slug,
          specializationSlug: page.subSubject?.slug ?? null,
          levelCode: page.courseLevel.code,
        }),
        subjectSlug: page.subject.slug,
        specializationSlug: page.subSubject?.slug ?? null,
        levelCode: page.courseLevel.code,
        levelSlug: publicLevelSlug(page.courseLevel.code),
        hasOwnContent: hasOwnContent({
          status: page.status,
          hasIntro: introduced.has(page.id),
          activeFaqCount: page._count.faqs,
        }),
        robotsIndex: robots.get(page.id) ?? templateRobotsIndex,
        updatedAt: page.updatedAt.toISOString(),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return { data, total: data.length, templateRobotsIndex };
  }

  /* ---- Reading an owner, its levels and its pages. ---- */

  /** The subject or specialization, draft or published: an editor may write
   * a page before the field goes live. */
  private async resolveOwner(owner: LevelPageOwner): Promise<ResolvedOwner> {
    const select = { id: true, name: true, slug: true, status: true };
    if (owner.kind === 'subject') {
      const subject = await this.prisma.subject.findFirst({
        where: { id: owner.id, deletedAt: null },
        select,
      });
      if (!subject)
        throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
      return {
        subject,
        specialization: null,
        key: { subjectId: subject.id, scopeKey: '' },
      };
    }
    const specialization = await this.prisma.subSubject.findFirst({
      where: { id: owner.id, deletedAt: null, subject: { deletedAt: null } },
      select: { ...select, subject: { select } },
    });
    if (!specialization)
      throw catalogNotFound(
        'SUB_SUBJECT_NOT_FOUND',
        'Specialization not found',
      );
    const { subject, ...own } = specialization;
    return {
      subject,
      specialization: own,
      key: { subjectId: subject.id, scopeKey: own.id },
    };
  }

  /**
   * Every level, and why the field is offered at each it is offered at.
   *
   * - A subject: its own ticks, the ticks of its published specializations,
   *   and the levels of its published courses (a specialization's courses
   *   carry the subject too).
   * - A specialization: its own ticks and its own published courses' levels.
   *   Its subject's ticks do not reach it.
   *
   * A level switched off under "All levels" offers nothing. An empty map
   * means the field is offered at nothing yet.
   */
  private async offered(owner: ResolvedOwner): Promise<Offered> {
    const courses = { status: 'PUBLISHED', deletedAt: null };
    const [levels, ticked, fromSpecializations, taught] = await Promise.all([
      this.prisma.courseLevel.findMany({ select: LEVEL_SELECT }),
      owner.specialization
        ? this.prisma.subSubjectCourseLevel.findMany({
            where: { subSubjectId: owner.specialization.id },
            select: { courseLevelId: true },
          })
        : this.prisma.subjectCourseLevel.findMany({
            where: { subjectId: owner.subject.id },
            select: { courseLevelId: true },
          }),
      owner.specialization
        ? Promise.resolve([])
        : this.prisma.subSubjectCourseLevel.findMany({
            where: {
              subSubject: { subjectId: owner.subject.id, ...PUBLISHED },
            },
            select: { courseLevelId: true },
          }),
      this.prisma.course.groupBy({
        by: ['courseLevelId'],
        where: owner.specialization
          ? { subSubjectId: owner.specialization.id, ...courses }
          : { subjectId: owner.subject.id, ...courses },
      }),
    ]);
    const known = new Map(levels.map((level) => [level.id, level]));
    const sources = new Map<string, Set<LevelSource>>();
    const add = (
      rows: Array<{ courseLevelId: string }>,
      source: LevelSource,
    ) => {
      for (const { courseLevelId } of rows) {
        if (known.get(courseLevelId)?.status !== 'ACTIVE') continue;
        const set = sources.get(courseLevelId) ?? new Set<LevelSource>();
        set.add(source);
        sources.set(courseLevelId, set);
      }
    };
    add(ticked, 'TICKED');
    add(fromSpecializations, 'SPECIALIZATION');
    add(taught, 'COURSES');
    return { levels: known, sources };
  }

  /**
   * The same rule for every field in the catalogue at once, for the
   * sitemap's list: three queries rather than three per field. Only
   * published specializations reach their subject; the pages read against
   * this are already narrowed to levels switched on.
   */
  private async catalogueOffered() {
    const courses = { status: 'PUBLISHED', deletedAt: null };
    const [subjectTicks, specializationTicks, taught] = await Promise.all([
      this.prisma.subjectCourseLevel.findMany({
        select: { subjectId: true, courseLevelId: true },
      }),
      this.prisma.subSubjectCourseLevel.findMany({
        where: { subSubject: PUBLISHED },
        select: {
          subSubjectId: true,
          courseLevelId: true,
          subSubject: { select: { subjectId: true } },
        },
      }),
      this.prisma.course.groupBy({
        by: ['subjectId', 'subSubjectId', 'courseLevelId'],
        where: courses,
      }),
    ]);
    const bySubject = new Map<string, Set<string>>();
    const bySpecialization = new Map<string, Set<string>>();
    const add = (map: Map<string, Set<string>>, key: string, id: string) => {
      const set = map.get(key) ?? new Set<string>();
      set.add(id);
      map.set(key, set);
    };
    for (const row of subjectTicks)
      add(bySubject, row.subjectId, row.courseLevelId);
    for (const row of specializationTicks) {
      add(bySubject, row.subSubject.subjectId, row.courseLevelId);
      add(bySpecialization, row.subSubjectId, row.courseLevelId);
    }
    for (const row of taught) {
      add(bySubject, row.subjectId, row.courseLevelId);
      if (row.subSubjectId)
        add(bySpecialization, row.subSubjectId, row.courseLevelId);
    }
    return { bySubject, bySpecialization };
  }

  /** The editor's view of one page. `offered` is what the caller already
   * read for the owner; saving a page does not change it. */
  private async detail(
    owner: ResolvedOwner,
    courseLevelId: string,
    { levels, sources }: Offered,
  ) {
    const page = await this.prisma.subjectLevelPage.findUnique({
      where: this.pageKey(owner, courseLevelId),
      include: { faqs: { orderBy: FAQ_ORDER } },
    });
    const level = levels.get(courseLevelId);
    if (!level)
      throw catalogNotFound('COURSE_LEVEL_NOT_FOUND', 'Course level not found');
    const seo = page
      ? toSeo(
          await this.prisma.seoMetadata.findUnique({
            where: {
              ownerType_ownerId: {
                ownerType: SUBJECT_LEVEL_PAGE_SEO_OWNER,
                ownerId: page.id,
              },
            },
            include: {
              ogMedia: { select: MEDIA_SELECT },
              twitterMedia: { select: MEDIA_SELECT },
            },
          }),
        )
      : null;
    const field = (row: Named) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
    });
    return {
      subject: field(owner.subject),
      specialization: owner.specialization ? field(owner.specialization) : null,
      level: this.levelRef(level),
      offered: sources.has(level.id),
      sources: this.sourceList(sources.get(level.id)),
      path: this.path(owner, level),
      page: page
        ? {
            id: page.id,
            status: page.status,
            intro: page.intro,
            admissionNote: page.admissionNote,
            careersNote: page.careersNote,
            faqs: page.faqs.map((faq) => ({
              id: faq.id,
              question: faq.question,
              answer: faq.answer,
              status: faq.status,
              displayOrder: faq.displayOrder,
              updatedAt: faq.updatedAt.toISOString(),
            })),
            seo,
            searchReady: hasOwnContent({
              status: page.status,
              hasIntro: page.intro !== null,
              activeFaqCount: page.faqs.filter((faq) => faq.status === 'ACTIVE')
                .length,
            }),
            createdAt: page.createdAt.toISOString(),
            updatedAt: page.updatedAt.toISOString(),
          }
        : null,
    };
  }

  private pageKey(owner: ResolvedOwner, courseLevelId: string) {
    return {
      subjectId_scopeKey_courseLevelId: { ...owner.key, courseLevelId },
    };
  }

  /**
   * The version an editor saw against the page as it is now. Null says
   * "there was no page": a page written since is a conflict. A version for
   * a page deleted since is one too. Left out, nothing is checked.
   */
  private checkVersion(
    current: { updatedAt: Date } | null,
    expected: string | null | undefined,
  ) {
    if (expected === undefined) return;
    const stale =
      expected === null
        ? current !== null
        : !current ||
          current.updatedAt.getTime() !== new Date(expected).getTime();
    if (stale) throw catalogConflict('LEVEL_PAGE_STALE_VERSION', STALE_MESSAGE);
  }

  private levelRef(level: LevelRow) {
    return {
      id: level.id,
      code: level.code,
      name: level.name,
      slug: publicLevelSlug(level.code),
      description: level.description,
      status: level.status,
    };
  }

  private sourceList(sources: Set<LevelSource> | undefined): LevelSource[] {
    return LEVEL_SOURCES.filter((source) => sources?.has(source));
  }

  private path(owner: ResolvedOwner, level: LevelRow) {
    return levelPagePath({
      subjectSlug: owner.subject.slug,
      specializationSlug: owner.specialization?.slug ?? null,
      levelCode: level.code,
    });
  }

  /* What the audit log keeps of a page: sizes and counts, not the text. */
  private summary(
    owner: ResolvedOwner,
    level: LevelRow,
    page: {
      status: string;
      intro: string | null;
      admissionNote: string | null;
      careersNote: string | null;
    },
    faqs: number,
  ) {
    return {
      subjectId: owner.subject.id,
      subSubjectId: owner.specialization?.id ?? null,
      courseLevelCode: level.code,
      status: page.status,
      introLength: page.intro?.length ?? 0,
      admissionNoteLength: page.admissionNote?.length ?? 0,
      careersNoteLength: page.careersNote?.length ?? 0,
      faqs,
    };
  }
}

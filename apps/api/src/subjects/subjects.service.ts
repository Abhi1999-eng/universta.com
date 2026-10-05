import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { attachDefaultTaxonomy } from '../countries/country-taxonomy-reconciler';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SEO_MANAGEMENT_RESOLVER } from '../seo-management/seo-management.tokens';
import type { SeoResolver } from '../seo-management/seo-management.types';
import {
  catalogConflict,
  catalogNotFound,
  catalogNotReady,
} from '../catalog/catalog.errors';
import {
  isUniqueConstraintError,
  paginationMeta,
  slugify,
} from '../catalog/catalog.constants';
import { writeAudit } from '../catalog/catalog.audit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { isCanonicalPublicSlug } from '../common/public-slug';
import {
  byEducationOrder,
  publicLevel,
  rankDestinations,
  type DestinationCountry,
  type OrderedLevel,
} from './public-order';
import type {
  CreateSubSubjectDto,
  CreateSubjectDto,
  SeoMetadataDto,
  SpecializationUniversitiesQueryDto,
  SubjectActionDto,
  SubjectListQueryDto,
  SubSubjectListQueryDto,
  UpdateSubSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';

/**
 * Live at `now`: published, not deleted, and inside the optional
 * [publishStartsAt, publishEndsAt) window that universities and their
 * offerings carry. The university list applies the same rule; nothing
 * flips the status when a window closes, so it is read here.
 */
function liveAt(now: Date) {
  return {
    status: 'PUBLISHED',
    deletedAt: null,
    AND: [
      { OR: [{ publishStartsAt: null }, { publishStartsAt: { lte: now } }] },
      { OR: [{ publishEndsAt: null }, { publishEndsAt: { gt: now } }] },
    ],
  };
}

const MEDIA_SELECT = {
  id: true,
  publicUrl: true,
  altText: true,
  title: true,
  width: true,
  height: true,
  status: true,
  deletedAt: true,
} as const;
const SUBJECT_INCLUDE = {
  iconMedia: { select: MEDIA_SELECT },
  listingMedia: { select: MEDIA_SELECT },
  heroMedia: { select: MEDIA_SELECT },
  /* The Country taxonomy picker orders by real usage and shows sub-subjects
   * beneath their parent for navigation. Both come from this include so the
   * picker never issues a query per row. */
  subSubjects: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  },
  _count: { select: { courses: true, countrySubjects: true } },
} satisfies Prisma.SubjectInclude;
const SUB_SUBJECT_INCLUDE = {
  iconMedia: { select: MEDIA_SELECT },
  listingMedia: { select: MEDIA_SELECT },
  subject: {
    select: { id: true, name: true, slug: true, status: true, deletedAt: true },
  },
} satisfies Prisma.SubSubjectInclude;

type MediaRecord = {
  id: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  status: string;
  deletedAt: Date | null;
} | null;
type SubjectRecord = Prisma.SubjectGetPayload<{
  include: typeof SUBJECT_INCLUDE;
}>;
type SubSubjectRecord = Prisma.SubSubjectGetPayload<{
  include: typeof SUB_SUBJECT_INCLUDE;
}>;

function actorId(request: AuthenticatedRequest): string {
  const id = request.user?.sub;
  if (!id)
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Super Admin access is required',
      details: null,
    });
  return id;
}

function media(record: MediaRecord) {
  return record && record.status === 'ACTIVE' && !record.deletedAt
    ? {
        id: record.id,
        url: record.publicUrl,
        alt: record.altText ?? record.title ?? '',
        title: record.title,
        width: record.width,
        height: record.height,
      }
    : null;
}

function versionMatches(
  current: Date,
  expected: string | undefined,
  code: string,
): void {
  if (expected && current.getTime() !== new Date(expected).getTime())
    throw catalogConflict(
      code,
      'The record changed in another session. Reload before saving',
    );
}

function validUrl(value: string | undefined): boolean {
  return !value || /^https?:\/\//i.test(value);
}

/**
 * The language tests a subject's destinations actually accept.
 *
 * "Required" and "optional" both count as accepted -- a test a destination
 * takes is a test you may need -- and the score shown is the highest minimum
 * any of them publishes, because that is the one that clears them all. A test
 * no destination records at all is left out rather than listed at zero.
 */
function summariseTests(rows: Array<Record<string, unknown>>): Array<{
  code: string;
  name: string;
  countries: number;
  minScore: string | null;
}> {
  const tests = [
    {
      code: 'IELTS',
      name: 'IELTS Academic',
      req: 'ieltsRequirement',
      score: 'ieltsMinScore',
    },
    {
      code: 'TOEFL',
      name: 'TOEFL iBT',
      req: 'toeflRequirement',
      score: 'toeflMinScore',
    },
    {
      code: 'PTE',
      name: 'PTE Academic',
      req: 'pteRequirement',
      score: 'pteMinScore',
    },
    {
      code: 'Duolingo',
      name: 'Duolingo English Test',
      req: 'duolingoRequirement',
      score: 'duolingoMinScore',
    },
  ];
  return tests
    .map((test) => {
      const accepted = rows.filter((row) => {
        const value = row[test.req];
        return value === 'required' || value === 'optional';
      });
      const scores = accepted
        .map((row) => Number(row[test.score]))
        .filter((value) => Number.isFinite(value) && value > 0);
      return {
        code: test.code,
        name: test.name,
        countries: accepted.length,
        minScore: scores.length ? String(Math.max(...scores)) : null,
      };
    })
    .filter((test) => test.countries > 0);
}

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEO_MANAGEMENT_RESOLVER)
    private readonly seoManagement?: SeoResolver,
  ) {}

  async publicList(query: SubjectListQueryDto) {
    const where: Prisma.SubjectWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
              { shortDescription: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        include: SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: await Promise.all(rows.map((row) => this.toPublic(row))),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  /**
   * One specialization, addressed the way its page is: inside its subject.
   * A slug is unique within a subject and not across the table -- "Animal
   * Science" is taught under three of them -- so the subject is part of the
   * lookup, not decoration on the URL.
   */
  async publicSpecialization(subjectSlug: string, slug: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        slug: subjectSlug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: { id: true, name: true, slug: true, shortDescription: true },
    });
    if (!subject)
      throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');

    const specialization = await this.prisma.subSubject.findFirst({
      where: {
        subjectId: subject.id,
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: SUB_SUBJECT_INCLUDE,
    });
    if (!specialization)
      throw catalogNotFound(
        'SPECIALIZATION_NOT_FOUND',
        'Specialization not found',
      );

    const siblingWhere = {
      subjectId: subject.id,
      status: 'PUBLISHED',
      deletedAt: null,
      id: { not: specialization.id },
    } satisfies Prisma.SubSubjectWhereInput;
    const now = new Date();
    const live = {
      status: 'PUBLISHED',
      deletedAt: null,
      AND: [
        { OR: [{ publishStartsAt: null }, { publishStartsAt: { lte: now } }] },
        { OR: [{ publishEndsAt: null }, { publishEndsAt: { gt: now } }] },
      ],
    };
    /* A university teaches this specialization when one of its live
       programmes is filed under it -- the same conditions the universities
       directory reads a subject through, one level further down. */
    const universityWhere = {
      ...live,
      country: { status: 'PUBLISHED', deletedAt: null },
      offerings: {
        some: {
          ...live,
          genericCourse: {
            subSubjectId: specialization.id,
            status: 'PUBLISHED',
            deletedAt: null,
          },
        },
      },
    } satisfies Prisma.UniversityWhereInput;
    const [
      siblings,
      siblingTotal,
      countries,
      teaching,
      courses,
      universities,
      universityTotal,
    ] = await Promise.all([
      this.prisma.subSubject.findMany({
        where: siblingWhere,
        select: { id: true, name: true, slug: true, shortDescription: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 12,
      }),
      /* The page shows a dozen and links to the rest, so it says how many
         the rest are. */
      this.prisma.subSubject.count({ where: siblingWhere }),
      this.prisma.countrySubSubject.findMany({
        where: {
          subSubjectId: specialization.id,
          country: { status: 'PUBLISHED', deletedAt: null },
        },
        select: {
          /* `iso2Code` is what draws the flag. Without it the chip falls
             back to three neutral bands, so India showed as a navy block
             next to its own name. The subject page beside this one has
             always selected it. */
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              iso2Code: true,
              displayOrder: true,
            },
          },
        },
      }),
      this.teachingCounts({ subSubjectId: specialization.id }),
      this.prisma.course.findMany({
        where: {
          subSubjectId: specialization.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        include: this.coursePublicInclude(),
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 9,
      }),
      this.prisma.university.findMany({
        where: universityWhere,
        select: {
          id: true,
          name: true,
          slug: true,
          country: { select: { name: true, slug: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        /* A few over the six the page shows, so a hand-typed slug the
           router cannot serve does not leave the group one short. */
        take: 8,
      }),
      this.prisma.university.count({ where: universityWhere }),
    ]);

    const siblingStats = await this.branchStats(siblings.map((row) => row.id));

    return {
      ...this.toSubSubjectPublic(specialization),
      subject,
      /* Each sibling carries what its card states -- a line about it, the
         levels it is taught at and how many programmes -- so the related
         cards read like the subject page's, not as a bare name. */
      siblings: siblings.map((row) => ({
        ...row,
        publishedCourseCount: siblingStats.get(row.id)?.count ?? 0,
        levels: siblingStats.get(row.id)?.levels ?? [],
      })),
      siblingTotal,
      availableCountryCount: teaching.size,
      countries: await this.destinations(countries, teaching),
      courses: courses.map((course) => this.toCourseCard(course)),
      universities: {
        total: universityTotal,
        data: universities
          .filter((row) => isCanonicalPublicSlug(row.slug))
          .slice(0, 6),
      },
    };
  }

  /**
   * How many published programmes each destination teaches, for a subject or
   * one of its specializations: the courses open to apply to in that
   * country, under the same conditions the course search counts by. A course
   * is mapped to a country once, so counting the mappings counts the courses.
   */
  private async teachingCounts(
    course: { subjectId: string } | { subSubjectId: string },
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.countryCourse.groupBy({
      by: ['countryId'],
      where: {
        course: { ...course, status: 'PUBLISHED', deletedAt: null },
        status: 'ACTIVE',
        deletedAt: null,
        availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
        country: { status: 'PUBLISHED', deletedAt: null },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.countryId, row._count._all]));
  }

  /**
   * The destinations band: every country linked to it, with the ones that
   * teach it first and most programmes first. A country that teaches it
   * without an editorial link is read in too, so a place with programmes is
   * never missing from the list because nobody ticked it.
   */
  private async destinations(
    linked: Array<{ country: DestinationCountry }>,
    teaching: Map<string, number>,
  ) {
    const known = new Set(linked.map((row) => row.country.id));
    const missing = [...teaching.keys()].filter((id) => !known.has(id));
    const unlinked = missing.length
      ? await this.prisma.country.findMany({
          where: {
            id: { in: missing },
            status: 'PUBLISHED',
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            iso2Code: true,
            displayOrder: true,
          },
        })
      : [];
    return rankDestinations(linked, teaching, unlinked);
  }

  /**
   * How many published programmes each branch has, and the levels that teach
   * them in the order a student climbs them -- one grouped query for the
   * lot rather than one per branch.
   */
  private async branchStats(scope: string[] | { subjectId: string }): Promise<
    Map<
      string,
      {
        count: number;
        levels: Array<{ id: string; name: string; code: string | null }>;
      }
    >
  > {
    const stats = new Map<
      string,
      {
        count: number;
        levels: Array<{ id: string; name: string; code: string | null }>;
      }
    >();
    if (Array.isArray(scope) && !scope.length) return stats;
    const rows = await this.prisma.course.groupBy({
      by: ['subSubjectId', 'courseLevelId'],
      where: {
        ...(Array.isArray(scope)
          ? { subSubjectId: { in: scope } }
          : { subjectId: scope.subjectId, subSubjectId: { not: null } }),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const levels = await this.levelsById(rows.map((row) => row.courseLevelId));
    for (const row of rows) {
      const key = row.subSubjectId;
      if (!key) continue;
      const entry = stats.get(key) ?? { count: 0, levels: [] };
      entry.count += row._count._all;
      const level = levels.get(row.courseLevelId);
      if (level && !entry.levels.some((item) => item.id === level.id))
        entry.levels.push(level);
      stats.set(key, entry);
    }
    for (const entry of stats.values())
      entry.levels = this.inEducationOrder(entry.levels, levels);
    return stats;
  }

  /** The levels behind a set of ids, with what they are ordered by. */
  private async levelsById(ids: string[]) {
    const unique = [...new Set(ids)];
    const rows = unique.length
      ? await this.prisma.courseLevel.findMany({
          where: { id: { in: unique } },
          select: {
            id: true,
            name: true,
            code: true,
            educationOrder: true,
            displayOrder: true,
          },
        })
      : [];
    return new Map(rows.map((row) => [row.id, row]));
  }

  /** Public levels, Foundation first and PhD last. */
  private inEducationOrder(
    levels: Array<{ id: string; name: string; code: string | null }>,
    known: Map<string, OrderedLevel & { id: string }>,
  ) {
    return levels
      .map((level) => known.get(level.id) ?? level)
      .sort(byEducationOrder)
      .map(publicLevel);
  }

  /**
   * The universities that teach one specialization, by name -- in one
   * destination when `country` is given.
   *
   * A course row here is a programme shared across universities, so a
   * specialization's page could list "BSc Computer Science" and never say
   * who teaches it. The university list can be narrowed to a subject and
   * not to a branch of one: asked about Software Engineering in the United
   * Kingdom it answered with every university there teaching any Computer
   * Science, eleven where four teach this.
   *
   * A university counts when it has a live offering of a course filed under
   * this specialization -- the rule the university list applies to a
   * subject, one level down, so the two can be read side by side. Ranked
   * first and then A to Z, the lists' own order; `meta.total` counts all of
   * them, not only the ones named.
   */
  async publicSpecializationUniversities(
    subjectSlug: string,
    slug: string,
    query: SpecializationUniversitiesQueryDto,
  ) {
    const specialization = await this.prisma.subSubject.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
        subject: {
          slug: subjectSlug.trim().toLowerCase(),
          status: 'PUBLISHED',
          deletedAt: null,
        },
      },
      select: { id: true, subjectId: true },
    });
    if (!specialization)
      throw catalogNotFound(
        'SPECIALIZATION_NOT_FOUND',
        'Specialization not found',
      );

    const now = new Date();
    const where: Prisma.UniversityWhereInput = {
      ...liveAt(now),
      /* A university is a destination's only while the destination is
         published, the same condition the university list applies. */
      country: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(query.country ? { slug: query.country } : {}),
      },
      offerings: {
        some: {
          ...liveAt(now),
          genericCourse: {
            subjectId: specialization.subjectId,
            subSubjectId: specialization.id,
          },
        },
      },
    };
    const [total, rows] = await Promise.all([
      this.prisma.university.count({ where }),
      this.prisma.university.findMany({
        where,
        orderBy: [
          { qsRanking: { sort: 'asc', nulls: 'last' } },
          { name: 'asc' },
        ],
        take: query.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          qsRanking: true,
          /* The main campus's city, as a list row prints it beside the
             name: the text an editor wrote, else the catalogue city. */
          campuses: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            take: 1,
            select: { city: true, cityRef: { select: { name: true } } },
          },
        },
      }),
    ]);
    return {
      /* An address the router cannot route is not offered, as on the
         university list. */
      data: rows
        .filter((row) => isCanonicalPublicSlug(row.slug))
        .map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          qsRanking: row.qsRanking,
          city:
            row.campuses[0]?.city?.trim() ||
            row.campuses[0]?.cityRef?.name?.trim() ||
            null,
        })),
      meta: { total, limit: query.limit },
    };
  }

  /**
   * Every specialization, across subjects. The flat list exists because
   * students search for the branch rather than the field it sits in; each row
   * still carries its subject, because that is what its address is built from.
   */
  async publicSpecializationList(query: {
    search?: string;
    subject?: string;
    /** A course level code, so the flat list can be narrowed the way the
     *  subject pages narrow theirs. */
    level?: string;
    slug?: string;
    limit?: string;
    page?: string;
  }) {
    const take = Math.min(Math.max(Number(query.limit) || 60, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const search = query.search?.trim();
    const where = {
      status: 'PUBLISHED',
      deletedAt: null,
      subject: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(query.subject?.trim()
          ? { slug: query.subject.trim().toLowerCase() }
          : {}),
      },
      ...(search ? { name: { contains: search } } : {}),
      /* An exact slug can match more than one row: the same branch is taught
         under several subjects. Callers that resolve a bare slug take the
         first and say so. */
      ...(query.slug?.trim() ? { slug: query.slug.trim().toLowerCase() } : {}),
      /* A level narrows to the branches that actually have a published
         programme at it, rather than to branches merely tagged with it. */
      ...(query.level?.trim()
        ? {
            courses: {
              some: {
                status: 'PUBLISHED',
                deletedAt: null,
                courseLevel: { code: query.level.trim().toUpperCase() },
              },
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.subSubject.findMany({
        where,
        include: SUB_SUBJECT_INCLUDE,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.subSubject.count({ where }),
    ]);
    /* How many programmes each branch on this page has, and which levels teach
       them -- one grouped query for the page rather than one per row. */
    const branchStats = await this.branchStats(rows.map((row) => row.id));
    return {
      data: rows.map((row) => ({
        ...this.toSubSubjectPublic(row),
        subject: {
          id: row.subject.id,
          name: row.subject.name,
          slug: row.subject.slug,
        },
        publishedCourseCount: branchStats.get(row.id)?.count ?? 0,
        levels: branchStats.get(row.id)?.levels ?? [],
      })),
      meta: { total, page, limit: take },
    };
  }

  async publicDetail(slug: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: SUBJECT_INCLUDE,
    });
    if (!subject)
      throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    const [
      children,
      levels,
      branchStats,
      featuredCourses,
      teaching,
      linkedCountries,
      languageRows,
      seo,
    ] = await Promise.all([
      this.prisma.subSubject.findMany({
        where: {
          subjectId: subject.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        include: SUB_SUBJECT_INCLUDE,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.course.groupBy({
        by: ['courseLevelId'],
        where: {
          subjectId: subject.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        _count: { _all: true },
      }),
      /* The same count, broken down one level further, so a specialization can
         state how many programmes it has and which levels teach it without the
         page issuing a query per branch. */
      this.branchStats({ subjectId: subject.id }),
      /* Featured first, then whatever else is published.
         Filtering on `isFeatured` alone meant a subject whose programmes
         nobody had ticked showed no programmes section at all -- on a page
         whose own lead said "Undergraduate (1)". Being featured is a
         preference about ordering, not a condition for existing. */
      this.prisma.course.findMany({
        where: {
          subjectId: subject.id,
          status: 'PUBLISHED',
          deletedAt: null,
        },
        include: this.coursePublicInclude(),
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 6,
      }),
      /* Programmes per destination. Their number is `availableCountryCount`
         -- derived from published course offerings, as it always was -- and
         the counts put the places that teach the subject at the head of its
         destinations. */
      this.teachingCounts({ subjectId: subject.id }),
      /* The editorial link, which is what the country editor sets and what
           the subject page's destinations section means. Every destination
           starts out linked to every subject, so on its own it ordered the
           band A to Z through countries that teach none of it. */
      this.prisma.countrySubject.findMany({
        where: {
          subjectId: subject.id,
          country: { status: 'PUBLISHED', deletedAt: null },
        },
        select: {
          country: {
            select: {
              id: true,
              name: true,
              slug: true,
              iso2Code: true,
              displayOrder: true,
            },
          },
        },
      }),
      /* Which language tests the destinations teaching this subject accept.
           Requirements are set per programme, not per subject, so this is the
           honest version of the reference's "tests you may need": the tests
           actually recorded against the places that run it. */
      this.prisma.countryLanguageRequirement.findMany({
        where: {
          country: {
            status: 'PUBLISHED',
            deletedAt: null,
            subjectMaps: { some: { subjectId: subject.id } },
          },
        },
        select: {
          ieltsRequirement: true,
          ieltsMinScore: true,
          toeflRequirement: true,
          toeflMinScore: true,
          pteRequirement: true,
          pteMinScore: true,
          duolingoRequirement: true,
          duolingoMinScore: true,
        },
      }),
      this.prisma.seoMetadata.findUnique({
        where: {
          ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: subject.id },
        },
        include: {
          ogMedia: { select: MEDIA_SELECT },
          twitterMedia: { select: MEDIA_SELECT },
        },
      }),
    ]);
    const levelNames = await this.levelsById(
      levels.map((row) => row.courseLevelId),
    );
    /* In the order a student climbs them, as every other list of levels on
       the site is: the grouped rows came back PhD first. */
    const courseCountsByLevel = levels
      .map((row) => {
        const level = levelNames.get(row.courseLevelId);
        return {
          level: level ?? {
            id: row.courseLevelId,
            name: 'Course level',
            code: null,
            educationOrder: Number.MAX_SAFE_INTEGER,
          },
          count: row._count._all,
        };
      })
      .sort((a, b) => byEducationOrder(a.level, b.level))
      .map((row) => ({ level: publicLevel(row.level), count: row.count }));
    return {
      ...(await this.toPublic(subject)),
      subSubjects: children.map((child) => ({
        ...this.toSubSubjectPublic(child),
        publishedCourseCount: branchStats.get(child.id)?.count ?? 0,
        levels: branchStats.get(child.id)?.levels ?? [],
      })),
      courseCountsByLevel,
      featuredCourses: featuredCourses.map((course) =>
        this.toCourseCard(course),
      ),
      availableCountryCount: teaching.size,
      countries: await this.destinations(linkedCountries, teaching),
      tests: summariseTests(languageRows),
      seo: this.seoManagement
        ? await this.seoManagement.resolve('subject', subject, this.toSeo(seo))
        : this.toSeo(seo),
    };
  }

  async adminList(query: SubjectListQueryDto) {
    const where: Prisma.SubjectWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subject.count({ where }),
      this.prisma.subject.findMany({
        where,
        include: SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => this.toAdmin(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: SUBJECT_INCLUDE,
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return this.toAdmin(row);
  }

  async create(dto: CreateSubjectDto, request: AuthenticatedRequest) {
    const userId = actorId(request);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.validateMedia([
      dto.iconMediaId,
      dto.listingMediaId,
      dto.heroMediaId,
    ]);
    try {
      const row = await this.prisma.subject.create({
        data: {
          name,
          slug,
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          iconMediaId: dto.iconMediaId,
          listingMediaId: dto.listingMediaId,
          heroMediaId: dto.heroMediaId,
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: SUBJECT_INCLUDE,
      });
      /* A field is taught everywhere until a destination says otherwise,
         which is what the taxonomy seed wrote for the subjects that
         existed then. One created afterwards reached no destination until
         somebody attached it by hand, two hundred and five times.

         Outside the create rather than inside it: the subject exists
         either way, and a destination list that failed to write is worth
         less than the subject. The deployment sweep and the country
         editor both still reach these rows. */
      const reached = await attachDefaultTaxonomy(this.prisma, {
        subjectId: row.id,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUBJECT',
        row.id,
        'CREATE',
        null,
        { name, slug, status: row.status },
        'Subject created',
      );
      /* `row` was read before the destinations were attached, so its count
         of them is zero. The picker that creates a subject inline shows
         this figure straight away. */
      return { ...this.toAdmin(row), countryCount: reached };
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUBJECT_CONFLICT',
          'Subject name or slug already exists',
        );
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.subjectRecord(id);
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    await this.validateMedia([
      dto.iconMediaId,
      dto.listingMediaId,
      dto.heroMediaId,
    ]);
    const data: Prisma.SubjectUncheckedUpdateInput = {
      name: dto.name.trim(),
      slug: dto.slug?.trim() || current.slug,
      ...(dto.shortDescription !== undefined
        ? { shortDescription: dto.shortDescription.trim() }
        : {}),
      ...(dto.overview !== undefined ? { overview: dto.overview.trim() } : {}),
      ...(dto.iconMediaId !== undefined
        ? { iconMediaId: dto.iconMediaId }
        : {}),
      ...(dto.listingMediaId !== undefined
        ? { listingMediaId: dto.listingMediaId }
        : {}),
      ...(dto.heroMediaId !== undefined
        ? { heroMediaId: dto.heroMediaId }
        : {}),
      ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
      ...(dto.displayOrder !== undefined
        ? { displayOrder: dto.displayOrder }
        : {}),
      updatedByUserId: userId,
    };
    try {
      const row = await this.prisma.subject.update({
        where: { id },
        data,
        include: SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUBJECT',
        id,
        'UPDATE',
        { name: current.name, slug: current.slug, status: current.status },
        { name: row.name, slug: row.slug, status: row.status },
        'Subject updated',
      );
      return this.toAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUBJECT_CONFLICT',
          'Subject name or slug already exists',
        );
      throw error;
    }
  }

  async publish(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const errors: Array<{ field: string; message: string }> = [];
    if (!row.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!row.slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!row.shortDescription)
      errors.push({
        field: 'shortDescription',
        message: 'Short description is required',
      });
    if (errors.length)
      throw catalogNotReady(
        'SUBJECT_NOT_READY',
        'Complete subject fields before publishing',
        errors,
      );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'PUBLISH',
      { status: row.status },
      { status: updated.status },
      'Subject published',
    );
    return this.toAdmin(updated);
  }

  async unpublish(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'UNPUBLISH',
      { status: row.status },
      { status: updated.status },
      'Subject unpublished',
    );
    return this.toAdmin(updated);
  }

  async remove(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subjectRecord(id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_STALE_VERSION',
    );
    const count = await this.prisma.course.count({
      where: { subjectId: id, deletedAt: null },
    });
    if (count)
      throw catalogConflict(
        'SUBJECT_IN_USE',
        'A subject referenced by courses cannot be deleted',
      );
    const updated = await this.prisma.subject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DRAFT',
        publishedAt: null,
        updatedByUserId: userId,
      },
      include: SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'DELETE',
      { name: row.name, status: row.status },
      { deleted: true, status: updated.status },
      'Subject soft-deleted',
    );
    return { deleted: true };
  }

  async adminSubSubjectList(subjectId: string, query: SubSubjectListQueryDto) {
    await this.ensureSubject(subjectId);
    const where: Prisma.SubSubjectWhereInput = {
      subjectId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { slug: { contains: query.q } },
            ],
          }
        : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.subSubject.count({ where }),
      this.prisma.subSubject.findMany({
        where,
        include: SUB_SUBJECT_INCLUDE,
        orderBy: this.orderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data: rows.map((row) => this.toSubSubjectAdmin(row)),
      meta: paginationMeta(query.page, query.limit, total),
    };
  }

  async getSubSubject(subjectId: string, id: string) {
    await this.ensureSubject(subjectId);
    const row = await this.subSubjectRecord(subjectId, id);
    return this.toSubSubjectAdmin(row);
  }

  async createSubSubject(
    subjectId: string,
    dto: CreateSubSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.ensureSubject(subjectId);
    const name = dto.name.trim();
    const slug = dto.slug?.trim() || slugify(name);
    await this.validateMedia([dto.iconMediaId, dto.listingMediaId]);
    try {
      const row = await this.prisma.subSubject.create({
        data: {
          subjectId,
          name,
          slug,
          shortDescription: dto.shortDescription?.trim(),
          overview: dto.overview?.trim(),
          iconMediaId: dto.iconMediaId,
          listingMediaId: dto.listingMediaId,
          isFeatured: dto.isFeatured ?? false,
          displayOrder: dto.displayOrder ?? 0,
          status: 'DRAFT',
          createdByUserId: userId,
          updatedByUserId: userId,
        },
        include: SUB_SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUB_SUBJECT',
        row.id,
        'CREATE',
        null,
        { subjectId, name, slug, status: row.status },
        'Sub-Subject created',
      );
      return this.toSubSubjectAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUB_SUBJECT_CONFLICT',
          'Sub-Subject name within the subject or slug already exists',
        );
      throw error;
    }
  }

  async updateSubSubject(
    subjectId: string,
    id: string,
    dto: UpdateSubSubjectDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const current = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    await this.validateMedia([dto.iconMediaId, dto.listingMediaId]);
    try {
      const row = await this.prisma.subSubject.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          slug: dto.slug?.trim() || current.slug,
          ...(dto.shortDescription !== undefined
            ? { shortDescription: dto.shortDescription.trim() }
            : {}),
          ...(dto.overview !== undefined
            ? { overview: dto.overview.trim() }
            : {}),
          ...(dto.iconMediaId !== undefined
            ? { iconMediaId: dto.iconMediaId }
            : {}),
          ...(dto.listingMediaId !== undefined
            ? { listingMediaId: dto.listingMediaId }
            : {}),
          ...(dto.isFeatured !== undefined
            ? { isFeatured: dto.isFeatured }
            : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
            : {}),
          updatedByUserId: userId,
        },
        include: SUB_SUBJECT_INCLUDE,
      });
      await writeAudit(
        this.prisma,
        request,
        userId,
        'CATALOG',
        'SUB_SUBJECT',
        id,
        'UPDATE',
        { name: current.name, slug: current.slug },
        { name: row.name, slug: row.slug },
        'Sub-Subject updated',
      );
      return this.toSubSubjectAdmin(row);
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw catalogConflict(
          'SUB_SUBJECT_CONFLICT',
          'Sub-Subject name within the subject or slug already exists',
        );
      throw error;
    }
  }

  async publishSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const parent = await this.ensureSubject(subjectId);
    const errors: Array<{ field: string; message: string }> = [];
    if (!row.name) errors.push({ field: 'name', message: 'Name is required' });
    if (!row.slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!row.shortDescription)
      errors.push({
        field: 'shortDescription',
        message: 'Short description is required',
      });
    if (parent.status !== 'PUBLISHED')
      errors.push({
        field: 'subject',
        message: 'The parent Subject must be published first',
      });
    if (errors.length)
      throw catalogNotReady(
        'SUB_SUBJECT_NOT_READY',
        'Complete sub-subject fields before publishing',
        errors,
      );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedByUserId: userId,
      },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'PUBLISH',
      { status: row.status },
      { status: updated.status },
      'Sub-Subject published',
    );
    return this.toSubSubjectAdmin(updated);
  }

  async unpublishSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: { status: 'DRAFT', publishedAt: null, updatedByUserId: userId },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'UNPUBLISH',
      { status: row.status },
      { status: updated.status },
      'Sub-Subject unpublished',
    );
    return this.toSubSubjectAdmin(updated);
  }

  async removeSubSubject(
    subjectId: string,
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    const row = await this.subSubjectRecord(subjectId, id);
    versionMatches(
      row.updatedAt,
      dto.expectedUpdatedAt,
      'SUB_SUBJECT_STALE_VERSION',
    );
    const count = await this.prisma.course.count({
      where: { subSubjectId: id, deletedAt: null },
    });
    if (count)
      throw catalogConflict(
        'SUB_SUBJECT_IN_USE',
        'A sub-subject referenced by courses cannot be deleted',
      );
    const updated = await this.prisma.subSubject.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'DRAFT',
        publishedAt: null,
        updatedByUserId: userId,
      },
      include: SUB_SUBJECT_INCLUDE,
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUB_SUBJECT',
      id,
      'DELETE',
      { name: row.name, status: row.status },
      { deleted: true, status: updated.status },
      'Sub-Subject soft-deleted',
    );
    return { deleted: true };
  }

  async getSeo(id: string) {
    await this.subjectRecord(id);
    return this.getSeoFor('SUBJECT', id);
  }

  async putSeo(id: string, dto: SeoMetadataDto, request: AuthenticatedRequest) {
    const userId = actorId(request);
    await this.subjectRecord(id);
    if (!validUrl(dto.canonicalUrl))
      throw catalogConflict(
        'SEO_URL_INVALID',
        'Canonical URL must use HTTP or HTTPS',
      );
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
    });
    const row = await this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
      create: this.seoData(id, 'SUBJECT', dto),
      update: this.seoData(id, 'SUBJECT', dto),
    });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'SEO_UPSERT',
      current ? { seoTitle: current.seoTitle } : null,
      { seoTitle: row.seoTitle, metaDescription: row.metaDescription },
      'Subject SEO saved',
    );
    return this.toSeo(row);
  }

  async deleteSeo(
    id: string,
    dto: SubjectActionDto,
    request: AuthenticatedRequest,
  ) {
    const userId = actorId(request);
    await this.subjectRecord(id);
    const current = await this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: 'SUBJECT', ownerId: id } },
    });
    if (!current) return { deleted: false };
    versionMatches(
      current.updatedAt,
      dto.expectedUpdatedAt,
      'SUBJECT_SEO_STALE_VERSION',
    );
    await this.prisma.seoMetadata.delete({ where: { id: current.id } });
    await writeAudit(
      this.prisma,
      request,
      userId,
      'CATALOG',
      'SUBJECT',
      id,
      'SEO_DELETE',
      { seoTitle: current.seoTitle },
      null,
      'Subject SEO deleted',
    );
    return { deleted: true };
  }

  private async subjectRecord(id: string) {
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
      include: SUBJECT_INCLUDE,
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return row;
  }

  private async subSubjectRecord(subjectId: string, id: string) {
    const row = await this.prisma.subSubject.findFirst({
      where: { id, subjectId, deletedAt: null },
      include: SUB_SUBJECT_INCLUDE,
    });
    if (!row)
      throw catalogNotFound('SUB_SUBJECT_NOT_FOUND', 'Sub-Subject not found');
    return row;
  }

  private async ensureSubject(id: string) {
    const row = await this.prisma.subject.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw catalogNotFound('SUBJECT_NOT_FOUND', 'Subject not found');
    return row;
  }

  private async validateMedia(ids: Array<string | undefined>) {
    const requested = [
      ...new Set(ids.filter((id): id is string => Boolean(id))),
    ];
    if (!requested.length) return;
    const count = await this.prisma.mediaAsset.count({
      where: {
        id: { in: requested },
        status: 'ACTIVE',
        mediaType: 'IMAGE',
        deletedAt: null,
      },
    });
    if (count !== requested.length)
      throw catalogConflict(
        'MEDIA_INVALID',
        'Selected media is not an active image',
      );
  }

  private orderBy(sort?: string): Array<{
    displayOrder?: 'asc' | 'desc';
    name?: 'asc' | 'desc';
    createdAt?: 'asc' | 'desc';
    updatedAt?: 'asc' | 'desc';
    isFeatured?: 'asc' | 'desc';
    id?: 'asc' | 'desc';
  }> {
    if (sort === 'name') return [{ name: 'asc' }, { id: 'asc' }];
    if (sort === 'createdAt') return [{ createdAt: 'desc' }, { id: 'asc' }];
    if (sort === 'updatedAt') return [{ updatedAt: 'desc' }, { id: 'asc' }];
    /* "featured" is still accepted, so a saved link keeps working, but it is
       the catalogue's own order now: nothing sets `isFeatured` any more, so
       sorting on it only read a column that is false on every row. */
    return [{ displayOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }];
  }

  private coursePublicInclude() {
    return {
      subject: { select: { id: true, name: true, slug: true } },
      subSubject: { select: { id: true, name: true, slug: true } },
      courseLevel: { select: { id: true, name: true, code: true } },
      featuredMedia: { select: MEDIA_SELECT },
      studyModes: {
        include: {
          studyMode: { select: { id: true, name: true, code: true } },
        },
      },
    } satisfies Prisma.CourseInclude;
  }

  private async toPublic(row: SubjectRecord) {
    const [courseCount, subSubjectCount, countries, levels] = await Promise.all(
      [
        this.prisma.course.count({
          where: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
        }),
        this.prisma.subSubject.count({
          where: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
        }),
        this.prisma.countryCourse.findMany({
          where: {
            course: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
            status: 'ACTIVE',
            deletedAt: null,
            availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
            country: { status: 'PUBLISHED', deletedAt: null },
          },
          select: { countryId: true },
          distinct: ['countryId'],
        }),
        /* The levels this subject is actually taught at, for the explorer's
         study-level filter. Derived from published courses rather than
         declared on the subject, so it cannot drift from the catalogue. */
        this.prisma.course.findMany({
          where: { subjectId: row.id, status: 'PUBLISHED', deletedAt: null },
          select: {
            courseLevel: {
              select: {
                code: true,
                name: true,
                educationOrder: true,
                displayOrder: true,
              },
            },
          },
          distinct: ['courseLevelId'],
        }),
      ],
    );
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      heroMedia: media(row.heroMedia),
      featured: row.isFeatured,
      displayOrder: row.displayOrder,
      publishedCourseCount: courseCount,
      publishedSubSubjectCount: subSubjectCount,
      availableCountryCount: countries.length,
      /* The subject explorer searches specializations alongside subjects, so
         a listing row carries its branches rather than making the page ask
         for them one subject at a time. The include already loads them; this
         narrows to the published ones. */
      /* Foundation first, PhD last: the explorer's level bar and each card's
         levels line are built from this, and the distinct read hands the
         levels back in whatever order it met them. */
      levels: levels
        .map((entry) => entry.courseLevel)
        .filter(Boolean)
        .sort(byEducationOrder)
        .map((level) => ({ code: level.code, name: level.name })),
      subSubjects: (row.subSubjects ?? [])
        .filter((child) => child.status === 'PUBLISHED')
        .map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
        })),
    };
  }

  private toAdmin(row: SubjectRecord) {
    return {
      ...this.toAdminBase(row),
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      heroMedia: media(row.heroMedia),
    };
  }

  private toAdminBase(row: SubjectRecord) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      subSubjects: row.subSubjects ?? [],
      /* "Most used" is ordered by these, so they have to be real counts
       * rather than a display hint. */
      courseCount: row._count?.courses ?? 0,
      countryCount: row._count?.countrySubjects ?? 0,
      shortDescription: row.shortDescription,
      overview: row.overview,
      isFeatured: row.isFeatured,
      displayOrder: row.displayOrder,
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSubSubjectPublic(row: SubSubjectRecord) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.shortDescription,
      overview: row.overview,
      iconMedia: media(row.iconMedia),
      listingMedia: media(row.listingMedia),
      featured: row.isFeatured,
      displayOrder: row.displayOrder,
    };
  }

  private toSubSubjectAdmin(row: SubSubjectRecord) {
    return {
      ...this.toSubSubjectPublic(row),
      subject: {
        id: row.subject.id,
        name: row.subject.name,
        slug: row.subject.slug,
      },
      status: row.status,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toCourseCard(row: any) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      shortName: row.shortName,
      qualificationName: row.qualificationName,
      subject: row.subject,
      subSubject: row.subSubject,
      courseLevel: row.courseLevel,
      studyModes: row.studyModes?.map((item: any) => item.studyMode),
      duration: {
        min: row.durationMin?.toString() ?? null,
        max: row.durationMax?.toString() ?? null,
        unit: row.durationUnit,
      },
      credits: row.credits?.toString() ?? null,
      featured: row.isFeatured,
      featuredMedia: media(row.featuredMedia),
    };
  }

  private toSeo(row: any) {
    return row
      ? {
          id: row.id,
          ownerType: row.ownerType,
          ownerId: row.ownerId,
          seoTitle: row.seoTitle,
          metaDescription: row.metaDescription,
          canonicalUrl: row.canonicalUrl,
          focusKeyword: row.focusKeyword,
          ogTitle: row.ogTitle,
          ogDescription: row.ogDescription,
          twitterTitle: row.twitterTitle,
          twitterDescription: row.twitterDescription,
          robotsIndex: row.robotsIndex,
          robotsFollow: row.robotsFollow,
          schemaJson: row.schemaJson,
          hreflangJson: row.hreflangJson,
          ogMedia: media(row.ogMedia),
          twitterMedia: media(row.twitterMedia),
          createdAt: row.createdAt?.toISOString(),
          updatedAt: row.updatedAt?.toISOString(),
        }
      : null;
  }

  private async getSeoFor(ownerType: string, ownerId: string) {
    return this.toSeo(
      await this.prisma.seoMetadata.findUnique({
        where: { ownerType_ownerId: { ownerType, ownerId } },
        include: {
          ogMedia: { select: MEDIA_SELECT },
          twitterMedia: { select: MEDIA_SELECT },
        },
      }),
    );
  }

  private seoData(
    ownerId: string,
    ownerType: string,
    dto: SeoMetadataDto,
  ): Prisma.SeoMetadataUncheckedCreateInput {
    return {
      ownerId,
      ownerType,
      seoTitle: dto.seoTitle.trim(),
      metaDescription: dto.metaDescription.trim(),
      canonicalUrl: dto.canonicalUrl?.trim(),
      focusKeyword: dto.focusKeyword?.trim(),
      ogTitle: dto.ogTitle?.trim(),
      ogDescription: dto.ogDescription?.trim(),
      ogMediaId: dto.ogMediaId,
      twitterTitle: dto.twitterTitle?.trim(),
      twitterDescription: dto.twitterDescription?.trim(),
      twitterMediaId: dto.twitterMediaId,
      robotsIndex: dto.robotsIndex ?? true,
      robotsFollow: dto.robotsFollow ?? true,
      schemaJson: dto.schemaJson as Prisma.InputJsonValue | undefined,
      hreflangJson: dto.hreflangJson as Prisma.InputJsonValue | undefined,
    };
  }
}

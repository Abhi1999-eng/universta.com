import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { ExperimentsService } from '../experiments/experiments.service';
import { PrismaService } from '../prisma/prisma.service';
import { DbNull } from '../generated/prisma/internal/prismaNamespaceBrowser';
import { parseChromeConfig } from '../settings/chrome-overrides';
import { isCanonicalPublicSlug } from '../common/public-slug';

export type Resource =
  | 'universities'
  | 'offerings'
  | 'scholarships'
  | 'consultants'
  | 'jobs'
  | 'events'
  | 'success-stories'
  | 'testimonials'
  | 'pages'
  | 'navigation-menus'
  | 'contact-inquiries';

type Query = Record<string, string | undefined>;
type Data = Record<string, unknown>;

const PAGE_LIMIT = 12;
const MAX_LIMIT = 50;
const resourceModel: Record<Resource, string> = {
  universities: 'university',
  offerings: 'universityCourseOffering',
  scholarships: 'scholarship',
  consultants: 'consultant',
  jobs: 'job',
  events: 'event',
  'success-stories': 'successStory',
  testimonials: 'testimonial',
  pages: 'page',
  'navigation-menus': 'navigationMenu',
  'contact-inquiries': 'contactInquiry',
};

function pageOf(query: Query) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query.limit ?? PAGE_LIMIT) || PAGE_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit };
}

function meta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total ? Math.ceil(total / limit) : 0,
  };
}

function publishedWhere() {
  return { status: 'PUBLISHED', deletedAt: null };
}

/**
 * Extends publishedWhere() with the optional [publishStartsAt, publishEndsAt)
 * scheduling window now available on University/Offering/Scholarship/
 * Consultant/Job/Event/SuccessStory/Testimonial/City. A PUBLISHED row is only
 * effectively live once `now` falls inside its window — this is the sole
 * enforcement point (no cron flips status), mirroring the existing
 * effectivePublicationWhere() pattern used for Pages/Sections.
 */
function publishedWhereScheduled(now: Date): Record<string, unknown> {
  return {
    ...publishedWhere(),
    AND: [
      { OR: [{ publishStartsAt: null }, { publishStartsAt: { lte: now } }] },
      { OR: [{ publishEndsAt: null }, { publishEndsAt: { gt: now } }] },
    ],
  };
}

/**
 * Read-time visibility for scheduled content: a PUBLISHED or SCHEDULED page
 * (or section, with 'ACTIVE' standing in for 'SCHEDULED' target state) is
 * only effectively live once `now` is inside its optional [startsAt, endsAt)
 * window. This is the sole source of truth for public visibility — no cron
 * job flips status, so a page/section that has passed its endsAt must stop
 * appearing purely from this query, and one whose startsAt hasn't arrived
 * yet must not appear early.
 */
function effectivePublicationWhere(
  liveStatuses: string[],
  now: Date,
): Record<string, unknown> {
  return {
    deletedAt: null,
    status: { in: liveStatuses },
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  };
}

function contains(value: string | undefined) {
  return value?.trim() ? { contains: value.trim() } : undefined;
}

/**
 * Bounded fetch-all cap for resources whose public listing needs an
 * application-level "effectively featured" sort (Prisma cannot express the
 * featuredFrom/featuredUntil window check as an ORDER BY without raw SQL).
 * Local/demo catalogs never approach this size per resource, so a single
 * bounded query plus in-memory sort is safe and avoids raw SQL.
 */
const FEATURED_FETCH_CAP = 500;

type FeaturedRow = {
  isFeatured: boolean;
  featuredFrom: Date | null;
  featuredUntil: Date | null;
  featuredPriority: number;
  displayOrder: number;
};

function isEffectivelyFeatured(row: FeaturedRow, now: Date): boolean {
  if (!row.isFeatured) return false;
  if (row.featuredFrom && row.featuredFrom > now) return false;
  if (row.featuredUntil && row.featuredUntil <= now) return false;
  return true;
}

/**
 * Effective-featured first, then featuredPriority ascending (lower number =
 * shown earlier among featured items), then displayOrder, then name — mirrors
 * the isFeatured/displayOrder/name ordering already used elsewhere, just with
 * the boolean replaced by the time-windowed effective value.
 */
/** Optional, additive result ordering for the public listing pages.
 *
 * The default stays exactly as before -- featured-first, then priority,
 * displayOrder, name -- so omitting `sort` cannot change any existing
 * response. Only an explicit, recognised `sort` value replaces the ordering,
 * and an unrecognised value falls back to the default rather than erroring,
 * so a stale bookmarked URL still renders. */
export function applyListSort<T extends Record<string, unknown>>(
  rows: T[],
  sort: string | undefined,
  fields: {
    name: (row: T) => string;
    amount?: (row: T) => number | null;
    deadline?: (row: T) => Date | null;
  },
): T[] {
  if (!sort) return rows;
  const byName = (a: T, b: T) => fields.name(a).localeCompare(fields.name(b));
  const dateOf = (row: T) => {
    const value = (row.publishedAt ?? row.createdAt) as Date | string | null;
    return value ? new Date(value).getTime() : 0;
  };
  const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return (a - b) * dir;
  };
  switch (sort) {
    case 'name-asc':
      return [...rows].sort(byName);
    case 'name-desc':
      return [...rows].sort((a, b) => byName(b, a));
    case 'newest':
      return [...rows].sort((a, b) => dateOf(b) - dateOf(a));
    case 'amount-desc':
      return fields.amount
        ? [...rows].sort((a, b) =>
            nullsLast(fields.amount!(a), fields.amount!(b), -1),
          )
        : rows;
    case 'amount-asc':
      return fields.amount
        ? [...rows].sort((a, b) =>
            nullsLast(fields.amount!(a), fields.amount!(b), 1),
          )
        : rows;
    case 'deadline':
      return fields.deadline
        ? [...rows].sort((a, b) =>
            nullsLast(
              fields.deadline!(a)?.getTime() ?? null,
              fields.deadline!(b)?.getTime() ?? null,
              1,
            ),
          )
        : rows;
    default:
      return rows;
  }
}

function sortByFeatured<T extends FeaturedRow>(
  rows: T[],
  now: Date,
  nameOf: (row: T) => string,
  tiebreak?: (a: T, b: T) => number,
): T[] {
  return [...rows].sort((a, b) => {
    const fa = isEffectivelyFeatured(a, now);
    const fb = isEffectivelyFeatured(b, now);
    if (fa !== fb) return fa ? -1 : 1;
    if (a.featuredPriority !== b.featuredPriority)
      return a.featuredPriority - b.featuredPriority;
    if (tiebreak) {
      const result = tiebreak(a, b);
      if (result !== 0) return result;
    }
    if (a.displayOrder !== b.displayOrder)
      return a.displayOrder - b.displayOrder;
    return nameOf(a).localeCompare(nameOf(b));
  });
}

function idFrom(actor: { sub?: string } | undefined) {
  if (!actor?.sub)
    throw new BadRequestException('Authenticated admin is required');
  return actor.sub;
}

function contactNumber() {
  return `CT-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function leadNumber() {
  return `LD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
}

@Injectable()
export class ExpandedService {
  private readonly contactAttempts = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly experiments: ExperimentsService,
  ) {}

  async editorial(slug: string, anonymousId?: string) {
    const now = new Date();
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        ...effectivePublicationWhere(['PUBLISHED', 'SCHEDULED'], now),
      },
      include: {
        sections: {
          where: effectivePublicationWhere(['ACTIVE', 'SCHEDULED'], now),
          orderBy: { displayOrder: 'asc' },
          include: { media: true },
        },
      },
    });
    if (!page)
      throw new NotFoundException({
        code: 'PAGE_NOT_FOUND',
        message: 'Page not found',
        details: null,
      });
    const overrides = await this.experiments.resolveOverridesForSections(
      page.sections.map((section) => section.id),
      anonymousId,
      now,
    );
    if (!overrides.size) return page;
    return {
      ...page,
      sections: page.sections.map((section) => {
        const override = overrides.get(section.id);
        if (!override) return section;
        return {
          ...section,
          eyebrow: override.eyebrow ?? section.eyebrow,
          heading: override.heading ?? section.heading,
          subheading: override.subheading ?? section.subheading,
          ctaPrimaryLabel: override.ctaPrimaryLabel ?? section.ctaPrimaryLabel,
          ctaPrimaryUrl: override.ctaPrimaryUrl ?? section.ctaPrimaryUrl,
          experimentKey: override.experimentKey,
          experimentVariantKey: override.key,
        };
      }),
    };
  }

  async resolveRedirect(path: string) {
    if (!path) return null;
    const redirect = await this.prisma.redirect.findFirst({
      where: { sourcePath: path, isActive: true },
    });
    if (!redirect) return null;
    await this.prisma.redirect.update({
      where: { id: redirect.id },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    });
    return {
      targetPath: redirect.targetPath,
      httpStatusCode: redirect.httpStatusCode,
    };
  }

  async navigation(menuKey: string) {
    const menu = await this.prisma.navigationMenu.findFirst({
      where: { menuKey, status: 'ACTIVE' },
      include: {
        items: {
          where: { status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
          include: { page: { select: { slug: true } } },
        },
      },
    });
    if (!menu) return menu;
    // The public header/footer render nested dropdowns, so the flat rows are
    // resolved into a parent/children tree here rather than in every consumer.
    // Each item also gets one resolved `href`, so the web app never re-implements
    // the linkType -> URL rules.
    return { ...menu, items: ExpandedService.navigationTree(menu.items) };
  }

  /** Resolves flat NavigationItem rows into an ordered two-level tree with a
   * concrete `href` per item. Items whose link cannot be resolved (a PAGE link
   * whose page was deleted, or an unsafe custom URL) are dropped rather than
   * rendered as a dead `#` placeholder. */
  static navigationTree(
    rows: Array<{
      id: string;
      parentItemId: string | null;
      label: string;
      linkType: string;
      customUrl: string | null;
      openInNewTab: boolean;
      displayOrder: number;
      page?: { slug: string } | null;
    }>,
  ) {
    const hrefOf = (row: (typeof rows)[number]): string | null => {
      if (row.linkType === 'PAGE')
        return row.page?.slug ? `/${row.page.slug}` : null;
      const url = row.customUrl?.trim();
      if (!url) return null;
      return /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(url) ? url : null;
    };
    const shape = (row: (typeof rows)[number]) => ({
      id: row.id,
      label: row.label,
      href: hrefOf(row),
      openInNewTab: row.openInNewTab,
      displayOrder: row.displayOrder,
    });
    const byOrder = (
      a: { displayOrder: number },
      b: { displayOrder: number },
    ) => a.displayOrder - b.displayOrder;
    const children = new Map<string, ReturnType<typeof shape>[]>();
    for (const row of rows) {
      if (!row.parentItemId) continue;
      const resolved = shape(row);
      if (!resolved.href) continue;
      const bucket = children.get(row.parentItemId) ?? [];
      bucket.push(resolved);
      children.set(row.parentItemId, bucket);
    }
    return (
      rows
        .filter((row) => !row.parentItemId)
        .sort(byOrder)
        .map((row) => ({
          ...shape(row),
          children: (children.get(row.id) ?? []).sort(byOrder),
        }))
        // Keep a top-level entry if it links somewhere itself, or is a dropdown
        // parent with at least one resolvable child.
        .filter((item) => item.href || item.children.length > 0)
    );
  }

  async list(
    resource: Exclude<
      Resource,
      'pages' | 'navigation-menus' | 'contact-inquiries'
    >,
    query: Query,
  ) {
    const { page, limit, skip } = pageOf(query);
    const q = contains(query.q);
    const now = new Date();
    if (resource === 'universities') {
      const where: any = {
        ...publishedWhereScheduled(now),
        ...(q ? { OR: [{ name: q }, { shortDescription: q }] } : {}),
        ...(query.country
          ? {
              country: {
                slug: query.country,
                status: 'PUBLISHED',
                deletedAt: null,
              },
            }
          : {}),
        ...(query.type ? { institutionType: query.type } : {}),
        ...(query.subject
          ? {
              offerings: {
                some: {
                  genericCourse: { subject: { slug: query.subject } },
                  ...publishedWhereScheduled(now),
                },
              },
            }
          : {}),
        // University has no direct City/State relation — only its campuses
        // carry freeform city/state text, so these filters match against
        // that campus text rather than the Country-scoped City/State models.
        ...(query.city
          ? { campuses: { some: { city: { contains: query.city } } } }
          : {}),
        ...(query.state
          ? { campuses: { some: { state: { contains: query.state } } } }
          : {}),
      };
      const all = (
        await this.prisma.university.findMany({
          where,
          take: FEATURED_FETCH_CAP,
          include: {
            country: { select: { name: true, slug: true } },
            campuses: {
              where: { status: 'ACTIVE', deletedAt: null },
              select: { id: true },
            },
            _count: {
              select: { offerings: { where: publishedWhereScheduled(now) } },
            },
          },
        })
      ).filter((row) => isCanonicalPublicSlug(row.slug));
      const sorted = applyListSort(
        sortByFeatured(all, now, (row) => row.name),
        query.sort,
        { name: (row) => row.name },
      );
      const total = sorted.length;
      const data = sorted.slice(skip, skip + limit);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'scholarships') {
      const where: any = {
        ...publishedWhereScheduled(now),
        ...(q ? { OR: [{ title: q }, { summary: q }] } : {}),
        ...(query.country
          ? { countries: { some: { country: { slug: query.country } } } }
          : {}),
        ...(query.university
          ? {
              universities: {
                some: { university: { slug: query.university } },
              },
            }
          : {}),
        ...(query.offering
          ? { offerings: { some: { offering: { slug: query.offering } } } }
          : {}),
        ...(query.subject
          ? {
              offerings: {
                some: {
                  offering: {
                    genericCourse: { subject: { slug: query.subject } },
                  },
                },
              },
            }
          : {}),
        ...(query.degreeLevel
          ? {
              offerings: {
                some: {
                  offering: { courseLevel: { code: query.degreeLevel } },
                },
              },
            }
          : {}),
        ...(query.type ? { benefitType: query.type } : {}),
        ...(query.amountMin
          ? { amount: { gte: Number(query.amountMin) } }
          : {}),
        ...(query.amountMax
          ? { amount: { lte: Number(query.amountMax) } }
          : {}),
        ...(query.deadline === 'open'
          ? { OR: [{ deadline: null }, { deadline: { gte: new Date() } }] }
          : {}),
      };
      const all = await this.prisma.scholarship.findMany({
        where,
        take: FEATURED_FETCH_CAP,
        include: {
          provider: true,
          countries: {
            include: { country: { select: { name: true, slug: true } } },
          },
          universities: {
            include: { university: { select: { name: true, slug: true } } },
          },
        },
      });
      const sorted = applyListSort(
        sortByFeatured(
          all,
          now,
          (row) => row.title,
          (a, b) => {
            if (a.deadline === b.deadline) return 0;
            if (a.deadline === null) return 1;
            if (b.deadline === null) return -1;
            return a.deadline.getTime() - b.deadline.getTime();
          },
        ),
        query.sort,
        {
          name: (row) => row.title,
          amount: (row) => (row.amount === null ? null : Number(row.amount)),
          deadline: (row) => row.deadline,
        },
      );
      const total = sorted.length;
      const data = sorted.slice(skip, skip + limit);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'consultants') {
      const where: any = {
        ...publishedWhereScheduled(now),
        ...(q
          ? { OR: [{ name: q }, { shortDescription: q }, { description: q }] }
          : {}),
        ...(query.location
          ? {
              locations: {
                some: {
                  location: {
                    slug: query.location,
                    status: 'ACTIVE',
                    deletedAt: null,
                  },
                },
              },
            }
          : {}),
        ...(query.country
          ? { countries: { some: { country: { slug: query.country } } } }
          : {}),
        ...(query.region
          ? {
              countries: {
                some: { country: { continent: { slug: query.region } } },
              },
            }
          : {}),
        ...(query.state
          ? {
              locations: {
                some: {
                  location: {
                    OR: [
                      { state: { contains: query.state } },
                      { stateRef: { slug: query.state } },
                    ],
                  },
                },
              },
            }
          : {}),
        ...(query.city
          ? {
              locations: {
                some: {
                  location: {
                    OR: [
                      { city: { contains: query.city } },
                      { cityRef: { slug: query.city } },
                    ],
                  },
                },
              },
            }
          : {}),
        ...(query.service
          ? { services: { some: { slug: query.service } } }
          : {}),
        ...(query.language
          ? { languages: { some: { name: { contains: query.language } } } }
          : {}),
        ...(query.verified === 'true'
          ? { verificationStatus: 'VERIFIED' }
          : {}),
      };
      const all = await this.prisma.consultant.findMany({
        where,
        take: FEATURED_FETCH_CAP,
        include: {
          locations: { include: { location: true } },
          countries: {
            include: { country: { select: { name: true, slug: true } } },
          },
          services: true,
          languages: true,
        },
      });
      const sorted = applyListSort(
        sortByFeatured(all, now, (row) => row.name),
        query.sort,
        { name: (row) => row.name },
      );
      const total = sorted.length;
      const data = sorted.slice(skip, skip + limit);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'jobs') {
      const where: any = {
        ...publishedWhereScheduled(now),
        ...(q ? { title: q } : {}),
        ...(query.location ? { location: { contains: query.location } } : {}),
        ...(query.city ? { city: { slug: query.city } } : {}),
        ...(query.state ? { state: { slug: query.state } } : {}),
        ...(query.country ? { country: { slug: query.country } } : {}),
        ...(query.remote ? { remoteStatus: query.remote } : {}),
        ...(query.department ? { department: query.department } : {}),
        ...(query.type ? { employmentType: query.type } : {}),
        ...(query.active === 'true'
          ? { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }
          : query.active === 'false'
            ? { expiryDate: { lt: now } }
            : { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }),
      };
      const all = await this.prisma.job.findMany({
        where,
        take: FEATURED_FETCH_CAP,
        include: {
          city: { select: { name: true, slug: true } },
          state: { select: { name: true, slug: true } },
          country: { select: { name: true, slug: true } },
        },
      });
      const sorted = sortByFeatured(all, now, (row) => row.title);
      const total = sorted.length;
      const data = sorted.slice(skip, skip + limit);
      return { data, meta: meta(page, limit, total) };
    }
    if (resource === 'events') {
      const where: any = {
        ...publishedWhereScheduled(now),
        ...(q ? { title: q } : {}),
        ...(query.location ? { venue: { contains: query.location } } : {}),
        ...(query.city ? { city: { slug: query.city } } : {}),
        ...(query.state ? { state: { slug: query.state } } : {}),
        ...(query.country ? { country: { slug: query.country } } : {}),
        ...(query.mode ? { eventType: query.mode } : {}),
        ...(query.when === 'past'
          ? { startsAt: { lt: now } }
          : query.when === 'upcoming'
            ? { startsAt: { gte: now } }
            : {}),
        ...(query.from ? { startsAt: { gte: new Date(query.from) } } : {}),
        ...(query.to ? { startsAt: { lte: new Date(query.to) } } : {}),
      };
      const all = await this.prisma.event.findMany({
        where,
        take: FEATURED_FETCH_CAP,
        include: {
          city: { select: { name: true, slug: true } },
          state: { select: { name: true, slug: true } },
          country: { select: { name: true, slug: true } },
        },
      });
      const sorted = sortByFeatured(
        all,
        now,
        (row) => row.title,
        (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
      );
      const total = sorted.length;
      const data = sorted.slice(skip, skip + limit);
      return { data, meta: meta(page, limit, total) };
    }
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const titleField = resource === 'testimonials' ? 'quote' : 'title';
    const where: any = {
      ...publishedWhereScheduled(now),
      ...(q ? { [titleField]: q } : {}),
    };
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      delegate.count({ where }),
    ]);
    return { data, meta: meta(page, limit, Number(total)) };
  }

  async detail(
    resource: Exclude<
      Resource,
      'pages' | 'navigation-menus' | 'contact-inquiries'
    >,
    slug: string,
  ) {
    const now = new Date();
    if (resource === 'universities') return this.universityDetail(slug);
    if (resource === 'scholarships') {
      const row = await this.prisma.scholarship.findFirst({
        where: { slug, ...publishedWhereScheduled(now) },
        include: {
          provider: true,
          countries: { include: { country: true } },
          universities: { include: { university: true } },
          offerings: {
            include: {
              offering: {
                include: {
                  university: true,
                  campus: true,
                  genericCourse: true,
                },
              },
            },
          },
        },
      });
      return this.withSeo(resource, row ?? this.notFound(resource));
    }
    if (resource === 'consultants') {
      const row = await this.prisma.consultant.findFirst({
        where: { slug, ...publishedWhereScheduled(now) },
        include: {
          locations: {
            include: { location: { include: { country: true } } },
          },
          countries: { include: { country: true } },
          services: true,
          languages: true,
        },
      });
      return this.withSeo(resource, row ?? this.notFound(resource));
    }
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const row = await delegate.findFirst({
      where: { slug, ...publishedWhereScheduled(now) },
    });
    return this.withSeo(resource, row ?? this.notFound(resource));
  }

  private async universityDetail(slug: string) {
    const now = new Date();
    const row = await this.prisma.university.findFirst({
      where: { slug, ...publishedWhereScheduled(now) },
      include: {
        country: true,
        campuses: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
        accreditations: {
          where: { status: 'ACTIVE', deletedAt: null },
          orderBy: { displayOrder: 'asc' },
        },
        offerings: {
          where: publishedWhereScheduled(now),
          include: {
            genericCourse: { include: { subject: true, courseLevel: true } },
            campus: true,
            intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    return this.withSeo('universities', row ?? this.notFound('universities'));
  }

  async universityOfferings(
    universitySlug: string,
    offeringSlug?: string,
    query: Query = {},
  ) {
    const now = new Date();
    const university = await this.prisma.university.findFirst({
      where: { slug: universitySlug, ...publishedWhereScheduled(now) },
      select: { id: true, name: true, slug: true },
    });
    if (!university) return this.notFound('universities');
    const where: any = {
      universityId: university.id,
      ...publishedWhereScheduled(now),
      ...(offeringSlug ? { slug: offeringSlug } : {}),
    };
    if (offeringSlug) {
      const row = await this.prisma.universityCourseOffering.findFirst({
        where,
        include: {
          university: { include: { country: true } },
          campus: true,
          genericCourse: {
            include: { subject: true, subSubject: true, courseLevel: true },
          },
          intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
          requirements: {
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return this.withSeo('offerings', row ?? this.notFound('offerings'));
    }
    const { page, limit, skip } = pageOf(query);
    const listingWhere: any = {
      ...where,
      ...(query.courseLevel
        ? { courseLevel: { code: query.courseLevel } }
        : {}),
      ...(query.studyMode ? { studyMode: query.studyMode } : {}),
      ...(query.intake
        ? { intakes: { some: { intake: { slug: query.intake } } } }
        : {}),
      ...(query.scholarshipAvailable === 'true'
        ? { scholarships: { some: {} } }
        : {}),
      ...(query.tuitionMin
        ? {
            OR: [
              { tuitionMax: null },
              { tuitionMax: { gte: Number(query.tuitionMin) } },
            ],
          }
        : {}),
      ...(query.tuitionMax
        ? {
            AND: [
              {
                OR: [
                  { tuitionMin: null },
                  { tuitionMin: { lte: Number(query.tuitionMax) } },
                ],
              },
            ],
          }
        : {}),
    };
    const all = await this.prisma.universityCourseOffering.findMany({
      where: listingWhere,
      take: FEATURED_FETCH_CAP,
      include: {
        campus: true,
        genericCourse: { include: { subject: true, courseLevel: true } },
        intakes: { where: { status: 'ACTIVE' }, include: { intake: true } },
      },
    });
    const sorted = sortByFeatured(all, now, (row) => row.name);
    const total = sorted.length;
    const data = sorted.slice(skip, skip + limit);
    return { university, data, meta: meta(page, limit, total) };
  }

  async consultantLocation(slug: string) {
    const location = await this.prisma.consultantLocation.findFirst({
      where: { slug, status: 'ACTIVE', deletedAt: null },
      include: {
        country: true,
        consultants: {
          include: {
            consultant: {
              include: {
                services: true,
                countries: { include: { country: true } },
                languages: true,
              },
            },
          },
        },
      },
    });
    if (!location) return this.notFound('consultant locations');
    const seo = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: {
          ownerType: 'consultantLocation',
          ownerId: location.id,
        },
      },
      include: { ogMedia: true, twitterMedia: true },
    });
    return { ...location, seo };
  }

  async compare(
    type: 'countries' | 'universities' | 'courses' | 'consultants',
    items: string[],
  ) {
    const slugs = [
      ...new Set(
        items.map((item) => item.trim().toLowerCase()).filter(Boolean),
      ),
    ].slice(0, 3);
    if (!slugs.length) return { items: [], invalid: [] };
    const now = new Date();
    if (type === 'countries') {
      const rows = await this.prisma.country.findMany({
        where: { slug: { in: slugs }, ...publishedWhere() },
        include: {
          costProfile: true,
          workProfile: true,
          languageRequirements: true,
          intakes: { include: { intake: true } },
          statistics: true,
        },
      });
      return this.ordered(slugs, rows);
    }
    if (type === 'universities')
      return this.ordered(
        slugs,
        (
          await this.prisma.university.findMany({
            where: { slug: { in: slugs }, ...publishedWhereScheduled(now) },
            include: {
              country: true,
              campuses: true,
              accreditations: true,
              _count: {
                select: { offerings: { where: publishedWhereScheduled(now) } },
              },
            },
          })
        ).filter((row) => isCanonicalPublicSlug(row.slug)),
      );
    if (type === 'courses')
      return this.ordered(
        slugs,
        await this.prisma.universityCourseOffering.findMany({
          where: { slug: { in: slugs }, ...publishedWhereScheduled(now) },
          include: {
            university: true,
            campus: true,
            genericCourse: { include: { courseLevel: true } },
            intakes: { include: { intake: true } },
            requirements: true,
          },
        }),
      );
    return this.ordered(
      slugs,
      await this.prisma.consultant.findMany({
        where: { slug: { in: slugs }, ...publishedWhereScheduled(now) },
        include: {
          locations: { include: { location: true } },
          countries: { include: { country: true } },
          services: true,
          languages: true,
        },
      }),
    );
  }

  async comparisonOptions(
    type: 'countries' | 'universities' | 'courses' | 'consultants',
  ) {
    const now = new Date();
    const select = { slug: true, name: true } as const;
    if (type === 'countries')
      return (
        await this.prisma.country.findMany({
          where: publishedWhere(),
          select,
          orderBy: { name: 'asc' },
        })
      ).filter((row) => isCanonicalPublicSlug(row.slug));
    if (type === 'universities')
      return (
        await this.prisma.university.findMany({
          where: publishedWhereScheduled(now),
          select,
          orderBy: { name: 'asc' },
        })
      ).filter((row) => isCanonicalPublicSlug(row.slug));
    if (type === 'courses')
      return (
        await this.prisma.universityCourseOffering.findMany({
          where: publishedWhereScheduled(now),
          select: { slug: true, name: true },
          orderBy: { name: 'asc' },
        })
      ).filter((row) => isCanonicalPublicSlug(row.slug));
    return (
      await this.prisma.consultant.findMany({
        where: publishedWhereScheduled(now),
        select,
        orderBy: { name: 'asc' },
      })
    ).filter((row) => isCanonicalPublicSlug(row.slug));
  }

  private ordered(slugs: string[], rows: Array<{ slug: string }>) {
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    return {
      items: slugs.flatMap((slug) =>
        bySlug.has(slug) ? [bySlug.get(slug)!] : [],
      ),
      invalid: slugs.filter((slug) => !bySlug.has(slug)),
    };
  }

  async createContact(dto: Data, origin?: string) {
    if (dto.companyWebsite) return { received: true };
    const fullName = this.requiredText(dto.fullName, 'fullName');
    const email = this.requiredEmail(dto.email);
    const message = this.requiredText(dto.message, 'message');
    if (dto.privacyConsent !== true)
      throw new UnprocessableEntityException({
        code: 'CONTACT_PRIVACY_REQUIRED',
        message: 'Privacy consent is required',
        details: null,
      });
    const key = `${email}:${origin ?? ''}`;
    const previous = this.contactAttempts.get(key) ?? 0;
    if (Date.now() - previous < 10_000) return { received: true };
    this.contactAttempts.set(key, Date.now());
    const row = await this.prisma.contactInquiry.create({
      data: {
        inquiryNumber: contactNumber(),
        fullName,
        email,
        phoneNumber: this.optionalText(dto.phoneNumber),
        subject: this.optionalText(dto.subject),
        message,
        privacyConsent: true,
      },
    });
    return { received: true, inquiryNumber: row.inquiryNumber };
  }

  async adminList(resource: Resource, query: Query) {
    const { page, limit, skip } = pageOf(query);
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const q = contains(query.q);
    const where: any =
      resource === 'navigation-menus' ? {} : { deletedAt: null };
    if (q)
      where.OR =
        resource === 'contact-inquiries'
          ? [{ fullName: q }, { email: q }, { inquiryNumber: q }]
          : [{ name: q }, { title: q }, { slug: q }];
    if (query.status) where.status = query.status;
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updatedAt: 'desc' }],
      }),
      delegate.count({ where }),
    ]);
    if (resource === 'navigation-menus') {
      // Every menu looks equally "live" in a bare list -- Publish/Unpublish
      // says nothing about whether the site actually reads it. Annotating
      // each row with the chrome slot it resolves to (or null) is what lets
      // the admin tell "Primary Navigation" (renders the header) apart from
      // "Primary" (nothing reads it, however published it looks).
      const usage = await this.navigationMenuUsage();
      for (const row of data as Array<{
        menuKey: string;
        usedAs?: string | null;
      }>)
        row.usedAs =
          row.menuKey === usage.headerKey
            ? 'header'
            : row.menuKey === usage.footerKey
              ? 'footer'
              : null;
    }
    return { data, meta: meta(page, limit, Number(total)) };
  }

  async adminDetail(resource: Resource, id: string) {
    if (resource === 'universities') {
      const record = await this.prisma.university.findFirst({
        where: { id, deletedAt: null },
        include: {
          country: true,
          campuses: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
          accreditations: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'offerings') {
      const record = await this.prisma.universityCourseOffering.findFirst({
        where: { id, deletedAt: null },
        include: {
          university: true,
          campus: true,
          genericCourse: true,
          courseLevel: true,
          intakes: {
            include: { intake: true },
            orderBy: { intake: { monthNumber: 'asc' } },
          },
          requirements: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'scholarships') {
      const record = await this.prisma.scholarship.findFirst({
        where: { id, deletedAt: null },
        include: {
          provider: true,
          countries: { include: { country: true } },
          universities: { include: { university: true } },
          offerings: { include: { offering: true } },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'pages') {
      const record = await this.prisma.page.findFirst({
        where: { id, deletedAt: null },
        include: {
          template: true,
          sections: {
            where: { deletedAt: null },
            orderBy: { displayOrder: 'asc' },
            include: { media: true },
          },
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    if (resource === 'consultants') {
      const record = await this.prisma.consultant.findFirst({
        where: { id, deletedAt: null },
        include: {
          locations: { include: { location: true } },
          services: { orderBy: { displayOrder: 'asc' } },
          countries: { include: { country: true } },
          languages: true,
        },
      });
      return this.withSeo(resource, record ?? this.notFound(resource));
    }
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const row = await delegate.findFirst({
      where: resource === 'navigation-menus' ? { id } : { id, deletedAt: null },
    });
    return this.withSeo(resource, row ?? this.notFound(resource));
  }

  async adminCreate(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const data = this.writeData(resource, body);
    try {
      const created = await delegate.create({
        data: { ...data, ...this.relationWrites(resource, body, false) },
      });
      await this.saveSeo(resource, String(created.id), body.seo);
      return created;
    } catch (error) {
      throw this.conflict(error);
    }
  }

  async adminUpdate(
    resource: Exclude<Resource, 'contact-inquiries'>,
    id: string,
    body: Data,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    const current = await this.adminDetail(resource, id);
    try {
      const updated = await delegate.update({
        where: { id },
        data: {
          ...this.writeData(resource, body, true),
          ...this.relationWrites(resource, body, true),
        },
      });
      await this.saveSeo(resource, id, body.seo);
      await this.recordSlugRedirect(resource, current, updated);
      return updated;
    } catch (error) {
      throw this.conflict(error);
    }
  }

  /** Flat top-level resources with a stable public detail URL of the shape
   * `{prefix}/{slug}`. Nested resources (offerings, which live under a
   * university) and slug-less resources (testimonials) are out of scope for
   * this automatic redirect — a slug rename there needs its own handling. */
  private static readonly PUBLIC_PATH_PREFIX: Partial<
    Record<Resource, string>
  > = {
    universities: '/universities',
    scholarships: '/scholarships',
    consultants: '/study-abroad-consultants',
    jobs: '/careers',
    events: '/events',
  };

  private async recordSlugRedirect(
    resource: Resource,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) {
    const prefix = ExpandedService.PUBLIC_PATH_PREFIX[resource];
    if (!prefix) return;
    const oldSlug = typeof before.slug === 'string' ? before.slug : null;
    const newSlug = typeof after.slug === 'string' ? after.slug : null;
    if (!oldSlug || !newSlug || oldSlug === newSlug) return;
    await this.prisma.redirect.upsert({
      where: { sourcePath: `${prefix}/${oldSlug}` },
      update: {
        targetPath: `${prefix}/${newSlug}`,
        httpStatusCode: 301,
        isActive: true,
      },
      create: {
        sourcePath: `${prefix}/${oldSlug}`,
        targetPath: `${prefix}/${newSlug}`,
        httpStatusCode: 301,
      },
    });
  }

  async adminPublish(
    resource: Exclude<Resource, 'contact-inquiries'>,
    id: string,
    published: boolean,
  ) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    await this.adminDetail(resource, id);
    if (resource === 'navigation-menus')
      return delegate.update({
        where: { id },
        data: { status: published ? 'ACTIVE' : 'INACTIVE' },
      });
    return delegate.update({
      where: { id },
      data: {
        status: published ? 'PUBLISHED' : 'DRAFT',
        publishedAt: published ? new Date() : null,
      },
    });
  }

  async adminDelete(resource: Resource, id: string) {
    // Prisma's generated delegates are selected by a validated resource key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const delegate = this.prisma[
      resourceModel[resource] as keyof PrismaService
    ] as any;
    await this.adminDetail(resource, id);
    if (resource === 'navigation-menus')
      return delegate.update({ where: { id }, data: { status: 'INACTIVE' } });
    return delegate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(resource === 'contact-inquiries' ? {} : { status: 'DRAFT' }),
      },
    });
  }

  /** Block types the admin editor can add. Kept as a plain string on the
   * column, but this is the enum the editor UI actually offers. */
  static readonly SECTION_TYPES = [
    'HERO',
    'RICH_TEXT',
    'CTA',
    'IMAGE',
    'IMAGE_TEXT',
    'CARD_GRID',
    'STATS',
    'FAQ_GROUP',
    'RELATED_LINKS',
    'COUNTRY_DIRECTORY',
    'UNIVERSITY_DIRECTORY',
    'COURSE_DIRECTORY',
    'SCHOLARSHIP_DIRECTORY',
    'CONSULTANT_DIRECTORY',
    'TESTIMONIALS',
    'SUCCESS_STORIES',
    'LEAD_GENERATION',
    'CUSTOM',
  ] as const;

  /** Section content is modeled as plain-text fields (paragraphs, labels,
   * questions/answers), never raw HTML -- there is no rich-text-as-markup
   * path anywhere in this feature, so there is nothing for a renderer to
   * unsafely inject. This strips any stray `html`/`__html` key a client
   * might send so that invariant holds regardless of what the admin UI
   * sends, and caps how deep/wide a client-supplied body can get. */
  private static sanitizeSectionBody(value: unknown, depth = 0): unknown {
    if (depth > 4) return null;
    if (Array.isArray(value))
      return value
        .slice(0, 50)
        .map((item) => ExpandedService.sanitizeSectionBody(item, depth + 1));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (
          key === 'html' ||
          key === '__html' ||
          key === 'dangerouslySetInnerHTML'
        )
          continue;
        out[key] = ExpandedService.sanitizeSectionBody(item, depth + 1);
      }
      return out;
    }
    if (typeof value === 'string') return value.slice(0, 5000);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return null;
  }

  private async requirePage(pageId: string) {
    const page = await this.prisma.page.findFirst({
      where: { id: pageId, deletedAt: null },
    });
    if (!page) this.notFound('pages');
    return page;
  }

  private slugifySectionKey(input: string) {
    const base =
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'section';
    return `${base}-${randomUUID().slice(0, 6)}`;
  }

  private sectionWriteData(body: Data, existingConfig?: unknown) {
    const sectionType = this.optionalText(body.sectionType);
    if (
      sectionType &&
      !(ExpandedService.SECTION_TYPES as readonly string[]).includes(
        sectionType,
      )
    )
      throw new BadRequestException({
        code: 'INVALID_SECTION_TYPE',
        message: `sectionType must be one of ${ExpandedService.SECTION_TYPES.join(', ')}`,
        details: null,
      });
    const data: Data = {};
    if (sectionType) data.sectionType = sectionType;
    for (const key of [
      'eyebrow',
      'heading',
      'ctaPrimaryLabel',
      'ctaPrimaryUrl',
      'ctaSecondaryLabel',
      'ctaSecondaryUrl',
      'status',
      'mediaId',
      'backgroundMediaId',
    ] as const)
      if (body[key] !== undefined) data[key] = this.optionalText(body[key]);
    if (body.subheading !== undefined)
      data.subheading = this.optionalText(body.subheading);
    if (body.bodyJson !== undefined)
      data.bodyJson = ExpandedService.sanitizeSectionBody(body.bodyJson);
    if (body.configurationJson !== undefined)
      data.configurationJson = body.configurationJson;
    // Per-device visibility. Stored inside the existing configurationJson
    // column (no migration) but written through a validated, structured shape
    // so the admin never edits raw JSON. Anything already stored in
    // configurationJson is preserved.
    if (body.visibility !== undefined) {
      const requested = (body.visibility ?? {}) as Record<string, unknown>;
      const flag = (key: string) => requested[key] !== false;
      const visibility = {
        desktop: flag('desktop'),
        tablet: flag('tablet'),
        mobile: flag('mobile'),
      };
      if (!visibility.desktop && !visibility.tablet && !visibility.mobile)
        throw new BadRequestException({
          code: 'SECTION_HIDDEN_EVERYWHERE',
          message:
            'A section must stay visible on at least one device. Archive or remove it instead of hiding it everywhere.',
          details: null,
        });
      // Merge over whatever the row already stores so writing visibility
      // alone cannot discard unrelated configuration.
      const base =
        (data.configurationJson as Record<string, unknown> | undefined) ??
        (existingConfig as Record<string, unknown> | null | undefined) ??
        {};
      data.configurationJson = { ...base, visibility };
    }
    if (body.startsAt !== undefined)
      data.startsAt = this.dateValue(body.startsAt) ?? null;
    if (body.endsAt !== undefined)
      data.endsAt = this.dateValue(body.endsAt) ?? null;
    return data;
  }

  async createPageSection(pageId: string, body: Data) {
    await this.requirePage(pageId);
    const heading = this.optionalText(body.heading) ?? 'Untitled section';
    const sectionKey =
      this.optionalText(body.sectionKey) ?? this.slugifySectionKey(heading);
    const maxOrder = await this.prisma.pageSection.aggregate({
      where: { pageId, deletedAt: null },
      _max: { displayOrder: true },
    });
    return this.prisma.pageSection.create({
      data: {
        pageId,
        sectionKey,
        sectionType: this.optionalText(body.sectionType) ?? 'CUSTOM',
        heading,
        status: this.optionalText(body.status) ?? 'DRAFT',
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
        ...this.sectionWriteData({ ...body, heading: undefined }),
      },
    });
  }

  async updatePageSection(pageId: string, sectionId: string, body: Data) {
    await this.requirePage(pageId);
    const section = await this.prisma.pageSection.findFirst({
      where: { id: sectionId, pageId, deletedAt: null },
    });
    if (!section) this.notFound('page section');
    return this.prisma.pageSection.update({
      where: { id: sectionId },
      data: this.sectionWriteData(body, section.configurationJson),
    });
  }

  async deletePageSection(pageId: string, sectionId: string) {
    await this.requirePage(pageId);
    const section = await this.prisma.pageSection.findFirst({
      where: { id: sectionId, pageId, deletedAt: null },
    });
    if (!section) this.notFound('page section');
    return this.prisma.pageSection.update({
      where: { id: sectionId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  async duplicatePageSection(pageId: string, sectionId: string) {
    await this.requirePage(pageId);
    const section = await this.prisma.pageSection.findFirst({
      where: { id: sectionId, pageId, deletedAt: null },
    });
    if (!section) this.notFound('page section');
    const maxOrder = await this.prisma.pageSection.aggregate({
      where: { pageId, deletedAt: null },
      _max: { displayOrder: true },
    });
    return this.prisma.pageSection.create({
      data: {
        pageId,
        sectionKey: this.slugifySectionKey(section.heading ?? 'section'),
        sectionType: section.sectionType,
        eyebrow: section.eyebrow,
        heading: section.heading ? `${section.heading} (copy)` : null,
        subheading: section.subheading,
        bodyJson: section.bodyJson as Prisma.InputJsonValue | undefined,
        mediaId: section.mediaId,
        backgroundMediaId: section.backgroundMediaId,
        ctaPrimaryLabel: section.ctaPrimaryLabel,
        ctaPrimaryUrl: section.ctaPrimaryUrl,
        ctaSecondaryLabel: section.ctaSecondaryLabel,
        ctaSecondaryUrl: section.ctaSecondaryUrl,
        configurationJson: section.configurationJson as
          Prisma.InputJsonValue | undefined,
        status: 'DRAFT',
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });
  }

  async reorderPageSections(pageId: string, orderedIds: string[]) {
    await this.requirePage(pageId);
    const sections = await this.prisma.pageSection.findMany({
      where: { pageId, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(sections.map((section) => section.id));
    if (
      orderedIds.length !== known.size ||
      !orderedIds.every((id) => known.has(id))
    )
      throw new BadRequestException({
        code: 'INVALID_SECTION_ORDER',
        message:
          'The section order must include every current section exactly once',
        details: null,
      });
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.pageSection.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
    return this.prisma.pageSection.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** Admin-only preview: ignores publish status and scheduling windows so an
   * editor can see draft/scheduled/archived content before it goes live. */
  async previewPage(id: string) {
    const page = await this.prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { displayOrder: 'asc' },
          include: { media: true },
        },
      },
    });
    return page ?? this.notFound('pages');
  }

  async convertContact(id: string, actor: { sub?: string } | undefined) {
    const actorId = idFrom(actor);
    return this.prisma.$transaction(async (tx) => {
      const inquiry = await tx.contactInquiry.findFirst({
        where: { id, deletedAt: null },
      });
      if (!inquiry) return this.notFound('contact inquiry');
      if (inquiry.convertedLeadId)
        return tx.lead.findUnique({ where: { id: inquiry.convertedLeadId } });
      if (!inquiry.phoneNumber)
        throw new UnprocessableEntityException({
          code: 'CONTACT_PHONE_REQUIRED',
          message: 'A phone number is required before conversion',
          details: null,
        });
      const [firstName, ...last] = inquiry.fullName.trim().split(/\s+/);
      const lead = await tx.lead.create({
        data: {
          leadNumber: leadNumber(),
          formType: 'CONTACT_CONVERSION',
          sourceType: 'CONTACT_INQUIRY',
          sourceEntityId: inquiry.id,
          sourcePageUrl: '/contact',
          firstName,
          lastName: last.join(' ') || null,
          email: inquiry.email,
          phoneNumber: inquiry.phoneNumber,
          message: inquiry.message,
          status: 'NEW',
          priority: 'NORMAL',
          privacyConsent: true,
          landingPageUrl: '/contact',
        },
      });
      await tx.contactInquiry.update({
        where: { id },
        data: {
          convertedLeadId: lead.id,
          convertedByUserId: actorId,
          convertedAt: new Date(),
          status: 'CONVERTED',
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          module: 'CONTACT',
          entityType: 'ContactInquiry',
          entityId: id,
          action: 'CONVERT_TO_LEAD',
          newValues: { leadId: lead.id },
          description: 'Contact enquiry converted to counselling lead',
        },
      });
      return lead;
    });
  }

  async formOptions() {
    const active = { deletedAt: null };
    const [
      countries,
      universities,
      offerings,
      courses,
      levels,
      modes,
      intakes,
      locations,
      providers,
      media,
    ] = await Promise.all([
      this.prisma.country.findMany({
        where: active,
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.university.findMany({
        where: active,
        select: { id: true, name: true, slug: true, countryId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.universityCourseOffering.findMany({
        where: active,
        select: { id: true, name: true, slug: true, universityId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.course.findMany({
        where: active,
        select: { id: true, name: true, slug: true, courseLevelId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.courseLevel.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { educationOrder: 'asc' },
      }),
      this.prisma.studyMode.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.intake.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, monthNumber: true },
        orderBy: { monthNumber: 'asc' },
      }),
      this.prisma.consultantLocation.findMany({
        where: active,
        select: { id: true, name: true, slug: true, city: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.scholarshipProvider.findMany({
        where: active,
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.mediaAsset.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true, altText: true, originalFileName: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    // Only published, non-deleted pages are offered as an internal-link
    // target: linking to anything else is exactly the "deleted target" /
    // "invalid target" failure mode a navigation item can otherwise fall
    // into silently.
    const pages = await this.prisma.page.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { id: true, title: true, slug: true },
      orderBy: { title: 'asc' },
    });
    const campuses = await this.prisma.universityCampus.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, universityId: true },
      orderBy: { name: 'asc' },
    });
    const states = await this.prisma.state.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, countryId: true },
      orderBy: { name: 'asc' },
    });
    const cities = await this.prisma.city.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        countryId: true,
        stateId: true,
      },
      orderBy: { name: 'asc' },
    });
    return {
      countries,
      universities,
      offerings,
      courses,
      levels,
      modes,
      intakes,
      locations,
      providers,
      media,
      campuses,
      states,
      cities,
      pages,
    };
  }

  private relationWrites(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
    replace: boolean,
  ): Data {
    const strings = (value: unknown) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (item): item is string =>
                  typeof item === 'string' && item.trim() !== '',
              ),
            ),
          ]
        : [];
    const rows = (value: unknown) =>
      Array.isArray(value)
        ? value.filter(
            (item): item is Data =>
              Boolean(item) && typeof item === 'object' && !Array.isArray(item),
          )
        : [];
    const reset = replace ? { deleteMany: {} } : {};

    if (resource === 'universities') {
      const campuses = rows(body.campuses).filter(
        (row) => typeof row.name === 'string' && row.name.trim(),
      );
      const accreditations = rows(body.accreditations).filter(
        (row) => typeof row.name === 'string' && row.name.trim(),
      );
      return {
        ...(Array.isArray(body.campuses)
          ? {
              campuses: {
                ...reset,
                create: campuses.map((row, index) => ({
                  name: String(row.name).trim(),
                  slug:
                    this.optionalText(row.slug) ??
                    `${String(row.name)
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '')}-${index + 1}`,
                  city: this.optionalText(row.city),
                  state: this.optionalText(row.state),
                  address: this.optionalText(row.address),
                  overview: this.optionalText(row.overview),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.accreditations)
          ? {
              accreditations: {
                ...reset,
                create: accreditations.map((row, index) => ({
                  name: String(row.name).trim(),
                  accreditor: this.optionalText(row.accreditor),
                  referenceUrl: this.optionalText(row.referenceUrl),
                  verifiedAt: this.dateValue(row.verifiedAt),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
      };
    }
    if (resource === 'offerings') {
      const intakes = rows(body.intakes).filter(
        (row) => typeof row.intakeId === 'string',
      );
      const requirements = rows(body.requirements).filter(
        (row) => typeof row.title === 'string' && row.title.trim(),
      );
      return {
        ...(Array.isArray(body.intakes)
          ? {
              intakes: {
                ...reset,
                create: intakes.map((row) => ({
                  intakeId: String(row.intakeId),
                  deadline: this.dateValue(row.deadline),
                  notes: this.optionalText(row.notes),
                  status: 'ACTIVE',
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.requirements)
          ? {
              requirements: {
                ...reset,
                create: requirements.map((row, index) => ({
                  category: this.optionalText(row.category) ?? 'ACADEMIC',
                  title: String(row.title).trim(),
                  description: this.optionalText(row.description),
                  minimumScore: this.decimalValue(row.minimumScore),
                  status: 'ACTIVE',
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
      };
    }
    if (resource === 'scholarships') {
      const countryIds = strings(body.countryIds);
      const universityIds = strings(body.universityIds);
      const offeringIds = strings(body.offeringIds);
      return {
        ...(Array.isArray(body.countryIds)
          ? {
              countries: {
                ...reset,
                create: countryIds.map((countryId) => ({ countryId })),
              },
            }
          : {}),
        ...(Array.isArray(body.universityIds)
          ? {
              universities: {
                ...reset,
                create: universityIds.map((universityId) => ({ universityId })),
              },
            }
          : {}),
        ...(Array.isArray(body.offeringIds)
          ? {
              offerings: {
                ...reset,
                create: offeringIds.map((offeringId) => ({ offeringId })),
              },
            }
          : {}),
      };
    }
    if (resource === 'consultants') {
      const locationIds = strings(body.locationIds);
      const countryIds = strings(body.countryIds);
      const services = strings(body.services);
      const languages = strings(body.languages);
      return {
        ...(Array.isArray(body.locationIds)
          ? {
              locations: {
                ...reset,
                create: locationIds.map((locationId) => ({ locationId })),
              },
            }
          : {}),
        ...(Array.isArray(body.countryIds)
          ? {
              countries: {
                ...reset,
                create: countryIds.map((countryId) => ({ countryId })),
              },
            }
          : {}),
        ...(Array.isArray(body.services)
          ? {
              services: {
                ...reset,
                create: services.map((name, index) => ({
                  name,
                  slug: `${name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')}-${index + 1}`,
                  displayOrder: index + 1,
                })),
              },
            }
          : {}),
        ...(Array.isArray(body.languages)
          ? {
              languages: {
                ...reset,
                create: languages.map((name) => ({ name })),
              },
            }
          : {}),
      };
    }
    return {};
  }

  private async saveSeo(resource: Resource, ownerId: string, value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const seo = value as Data;
    const seoTitle = this.optionalText(seo.seoTitle);
    const metaDescription = this.optionalText(seo.metaDescription);
    if (!seoTitle || !metaDescription) return;
    const shared = {
      seoTitle,
      metaDescription,
      canonicalUrl: this.optionalText(seo.canonicalUrl),
      focusKeyword: this.optionalText(seo.focusKeyword),
      ogTitle: this.optionalText(seo.ogTitle),
      ogDescription: this.optionalText(seo.ogDescription),
      ogMediaId: this.optionalText(seo.ogMediaId),
      twitterTitle: this.optionalText(seo.twitterTitle),
      twitterDescription: this.optionalText(seo.twitterDescription),
      twitterMediaId: this.optionalText(seo.twitterMediaId),
      robotsIndex: seo.robotsIndex !== false,
      robotsFollow: seo.robotsFollow !== false,
      ...(seo.schemaJson !== undefined
        ? { schemaJson: seo.schemaJson as Prisma.InputJsonValue }
        : {}),
    };
    await this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: resource, ownerId } },
      update: shared,
      create: { ownerType: resource, ownerId, ...shared },
    });
  }

  private async withSeo(resource: Resource, record: { id: unknown }) {
    const seo = await this.prisma.seoMetadata.findUnique({
      where: {
        ownerType_ownerId: { ownerType: resource, ownerId: String(record.id) },
      },
      include: { ogMedia: true, twitterMedia: true },
    });
    return { ...record, seo };
  }

  private decimalValue(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private dateValue(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
  }

  private writeData(
    resource: Exclude<Resource, 'contact-inquiries'>,
    body: Data,
    partial = false,
  ) {
    const ignored = new Set([
      'id',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'publishedAt',
      'seo',
      'campuses',
      'accreditations',
      'intakes',
      'requirements',
      'countryIds',
      'universityIds',
      'offeringIds',
      'locationIds',
      'services',
      'languages',
      'speakers',
      'providerName',
      // Never written straight from the body: an override is validated from
      // the structured `chrome` key below so a malformed or hand-crafted
      // payload cannot reach the column.
      'chromeConfigJson',
      'chrome',
    ]);
    const allowed: Partial<
      Record<Exclude<Resource, 'contact-inquiries'>, Set<string>>
    > = {
      universities: new Set([
        'countryId',
        'name',
        'slug',
        'institutionType',
        'shortDescription',
        'overview',
        'featuredMediaId',
        'sourceReference',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      offerings: new Set([
        'universityId',
        'genericCourseId',
        'campusId',
        'name',
        'slug',
        'shortDescription',
        'overview',
        'courseLevelId',
        'studyMode',
        'durationMin',
        'durationMax',
        'durationUnit',
        'tuitionMin',
        'tuitionMax',
        'currencyCode',
        'tuitionPeriod',
        'applicationUrl',
        'sourceReference',
        'featuredMediaId',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      scholarships: new Set([
        'providerId',
        'title',
        'slug',
        'summary',
        'description',
        'benefitType',
        'amount',
        'currencyCode',
        'eligibility',
        'deadline',
        'applicationUrl',
        'sourceReference',
        'featuredMediaId',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      consultants: new Set([
        'name',
        'slug',
        'shortDescription',
        'description',
        'email',
        'phone',
        'websiteUrl',
        'verificationStatus',
        'sourceReference',
        'featuredMediaId',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      jobs: new Set([
        'title',
        'slug',
        'summary',
        'department',
        'employmentType',
        'location',
        'cityId',
        'stateId',
        'countryId',
        'remoteStatus',
        'description',
        'responsibilities',
        'qualifications',
        'publishedDate',
        'expiryDate',
        'applicationUrl',
        'applicationEmail',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      events: new Set([
        'title',
        'slug',
        'summary',
        'description',
        'startsAt',
        'endsAt',
        'timezone',
        'eventType',
        'venue',
        'cityId',
        'stateId',
        'countryId',
        'onlineUrl',
        'registrationUrl',
        'featuredMediaId',
        'status',
        'isFeatured',
        'featuredPriority',
        'featuredFrom',
        'featuredUntil',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      'success-stories': new Set([
        'countryId',
        'universityId',
        'offeringId',
        'title',
        'slug',
        'journey',
        'attribution',
        'attributionNote',
        'featuredMediaId',
        'status',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
      testimonials: new Set([
        'universityId',
        'offeringId',
        'quote',
        'attribution',
        'attributionNote',
        'imageMediaId',
        'status',
        'publishStartsAt',
        'publishEndsAt',
        'displayOrder',
      ]),
    };
    const data: Data = {};
    for (const [key, value] of Object.entries(body))
      if (
        !ignored.has(key) &&
        value !== undefined &&
        (!allowed[resource] || allowed[resource]?.has(key))
      )
        data[key] = typeof value === 'string' ? value.trim() : value;
    const title =
      typeof data.title === 'string'
        ? data.title
        : typeof data.name === 'string'
          ? data.name
          : null;
    if (
      resource !== 'navigation-menus' &&
      !title &&
      !partial &&
      resource !== 'testimonials'
    )
      throw new UnprocessableEntityException({
        code: 'TITLE_REQUIRED',
        message: 'A title or name is required',
        details: null,
      });
    if (
      resource === 'testimonials' &&
      !partial &&
      !this.optionalText(data.quote)
    )
      throw new UnprocessableEntityException({
        code: 'QUOTE_REQUIRED',
        message: 'A testimonial quote is required',
        details: null,
      });
    if (
      [
        'universities',
        'offerings',
        'scholarships',
        'consultants',
        'jobs',
        'events',
        'success-stories',
        'pages',
      ].includes(resource) &&
      !this.optionalText(data.slug) &&
      !partial
    )
      throw new UnprocessableEntityException({
        code: 'SLUG_REQUIRED',
        message: 'A slug is required',
        details: null,
      });
    if (
      typeof data.slug === 'string' &&
      data.slug.length > 0 &&
      !isCanonicalPublicSlug(data.slug)
    )
      throw new UnprocessableEntityException({
        code: 'SLUG_INVALID',
        message:
          'Slug must contain lowercase letters and numbers separated by single hyphens',
        details: null,
      });
    if (resource === 'events' && Array.isArray(body.speakers))
      data.speakersJson = body.speakers;
    if (resource === 'pages' && body.chrome !== undefined)
      // null clears the override, which is how the Admin says "use Global".
      data.chromeConfigJson = parseChromeConfig(body.chrome) ?? DbNull;
    const normalizeDate = (key: string) => {
      if (!(key in data)) return;
      if (data[key] === null || data[key] === '') {
        data[key] = null;
        return;
      }
      const parsed = this.dateValue(data[key]);
      if (!parsed)
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: `${key} must be a valid date`,
          details: null,
        });
      data[key] = parsed;
    };
    const normalizeDecimal = (key: string) => {
      if (!(key in data)) return;
      if (data[key] === null || data[key] === '') {
        data[key] = null;
        return;
      }
      const parsed = this.decimalValue(data[key]);
      if (parsed === undefined)
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: `${key} must be a valid number`,
          details: null,
        });
      data[key] = parsed;
    };
    if (resource === 'offerings')
      for (const key of [
        'durationMin',
        'durationMax',
        'tuitionMin',
        'tuitionMax',
      ])
        normalizeDecimal(key);
    if (resource === 'scholarships') {
      normalizeDecimal('amount');
      normalizeDate('deadline');
    }
    const FEATURED_RESOURCES = new Set([
      'universities',
      'offerings',
      'scholarships',
      'consultants',
      'jobs',
      'events',
    ]);
    if (FEATURED_RESOURCES.has(resource)) {
      normalizeDate('featuredFrom');
      normalizeDate('featuredUntil');
      if ('isFeatured' in data)
        data.isFeatured =
          data.isFeatured === true || data.isFeatured === 'true';
    }
    const SCHEDULED_RESOURCES = new Set([
      'universities',
      'offerings',
      'scholarships',
      'consultants',
      'jobs',
      'events',
      'success-stories',
      'testimonials',
    ]);
    if (SCHEDULED_RESOURCES.has(resource)) {
      normalizeDate('publishStartsAt');
      normalizeDate('publishEndsAt');
    }
    if (resource === 'jobs') {
      normalizeDate('publishedDate');
      normalizeDate('expiryDate');
    }
    if (resource === 'events') {
      normalizeDate('startsAt');
      normalizeDate('endsAt');
      const startsAt = data.startsAt as Date | null | undefined;
      const endsAt = data.endsAt as Date | null | undefined;
      if (!startsAt)
        throw new UnprocessableEntityException({
          code: 'EVENT_START_REQUIRED',
          message: 'An event start date and time is required',
          details: null,
        });
      if (endsAt && endsAt <= startsAt)
        throw new UnprocessableEntityException({
          code: 'EVENT_DATE_RANGE_INVALID',
          message: 'Event end date and time must be after the start',
          details: null,
        });
    }
    if (data.status === 'PUBLISHED') data.publishedAt = new Date();
    return data;
  }

  private requiredText(value: unknown, name: string) {
    const text = this.optionalText(value);
    if (!text)
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: `${name} is required`,
        details: null,
      });
    return text;
  }
  private optionalText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  // --- Navigation menu items (ISS-019) -----------------------------------
  //
  // NavigationMenu itself was already a Phase1 resource -- list, create,
  // publish/unpublish, archive all worked. What did not exist anywhere was a
  // way to reach the links *inside* a menu: no admin screen offered an Edit
  // action, and no endpoint returned or accepted NavigationItem rows, even
  // though the model, the public site-chrome query and the live header and
  // footer all already depended on that table. The only route to a link was
  // the "Advanced JSON draft" textarea. These methods are the missing half.

  private navigationItemHref(row: {
    linkType: string;
    customUrl: string | null;
    page?: { slug: string; status: string; deletedAt: Date | null } | null;
  }): { href: string | null; brokenTarget: boolean } {
    if (row.linkType === 'NONE') return { href: null, brokenTarget: false };
    if (row.linkType === 'PAGE') {
      if (!row.page) return { href: null, brokenTarget: true };
      const usable = row.page.status === 'PUBLISHED' && !row.page.deletedAt;
      return {
        href: `/${row.page.slug}`,
        brokenTarget: !usable,
      };
    }
    const url = row.customUrl?.trim() ?? '';
    const valid = /^(\/[^\s]*|https:\/\/[^\s]+)$/.test(url);
    return { href: valid ? url : null, brokenTarget: !valid };
  }

  /** Which menu key the live site currently reads for each chrome slot.
   * Mirrors SettingsService.publicChrome's own defaulting so a menu that the
   * admin can see is never characterised differently from the one the site
   * actually renders. A menu whose key matches neither is not wired to
   * anything -- editing it would have no visible effect, which is exactly the
   * confusion an admin needs to be warned about before they invest time in
   * it (the demo data shipped exactly one such orphan, named "Primary"). */
  async navigationMenuUsage(): Promise<{
    headerKey: string;
    footerKey: string;
  }> {
    const rows = await this.prisma.siteSetting.findMany({
      where: { settingKey: { in: ['header', 'footer'] } },
    });
    const byKey = new Map(rows.map((row) => [row.settingKey, row]));
    const menuKeyOf = (group: 'header' | 'footer', fallback: string) => {
      const value = byKey.get(group)?.valueJson as
        { menuKey?: unknown } | undefined;
      return typeof value?.menuKey === 'string' && value.menuKey
        ? value.menuKey
        : fallback;
    };
    return {
      headerKey: menuKeyOf('header', 'header'),
      footerKey: menuKeyOf('footer', 'footer'),
    };
  }

  private async requireMenu(menuId: string) {
    const menu = await this.prisma.navigationMenu.findUnique({
      where: { id: menuId },
    });
    if (!menu) this.notFound('navigation-menus');
    return menu;
  }

  /** Every item in a menu, ordered, with its resolved public href and whether
   * that target is actually reachable -- a page that was unpublished or
   * soft-deleted after the link was created still satisfies the foreign key,
   * so the only way to catch it is to check the target's current state. */
  async navigationItems(menuId: string) {
    await this.requireMenu(menuId);
    const rows = await this.prisma.navigationItem.findMany({
      where: { menuId },
      include: {
        page: {
          select: { title: true, slug: true, status: true, deletedAt: true },
        },
      },
      orderBy: [{ parentItemId: 'asc' }, { displayOrder: 'asc' }],
    });
    return rows.map((row) => {
      const { href, brokenTarget } = this.navigationItemHref(row);
      return {
        id: row.id,
        menuId: row.menuId,
        parentItemId: row.parentItemId,
        label: row.label,
        linkType: row.linkType,
        pageId: row.pageId,
        pageTitle: row.page?.title ?? null,
        customUrl: row.customUrl,
        openInNewTab: row.openInNewTab,
        displayOrder: row.displayOrder,
        status: row.status,
        resolvedHref: href,
        brokenTarget,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  /** Shared create/update validation. Every rule here exists because the
   * public tree builder (`navigationTree`, above) resolves a broken or
   * ambiguous item by silently dropping it -- which reads as "the link
   * vanished" with nothing in any log, the same failure mode ISS-019 exists
   * to close off. Rejecting it here, with a message that names the field,
   * is what makes that failure visible at save time instead of on the
   * live site. */
  private async validateNavigationItem(
    menuId: string,
    body: Data,
    options: { partial: boolean; existingId?: string },
  ) {
    const data: Data = {};
    const has = (key: string) =>
      Object.prototype.hasOwnProperty.call(body, key);

    if (has('label') || !options.partial) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label)
        throw new UnprocessableEntityException({
          code: 'LABEL_REQUIRED',
          message: 'A label is required',
          details: null,
        });
      if (label.length > 150)
        throw new UnprocessableEntityException({
          code: 'LABEL_TOO_LONG',
          message: 'Label must be 150 characters or fewer',
          details: null,
        });
      data.label = label;
    }

    let linkType =
      typeof body.linkType === 'string' ? body.linkType : undefined;
    if (linkType !== undefined) {
      if (!['PAGE', 'CUSTOM', 'NONE'].includes(linkType))
        throw new UnprocessableEntityException({
          code: 'LINK_TYPE_INVALID',
          message: 'Link type must be PAGE, CUSTOM or NONE',
          details: null,
        });
      data.linkType = linkType;
    } else if (options.existingId) {
      const current = await this.prisma.navigationItem.findUnique({
        where: { id: options.existingId },
        select: { linkType: true },
      });
      linkType = current?.linkType;
    }

    if (linkType === 'PAGE') {
      if (has('pageId') || !options.partial) {
        const pageId = this.optionalText(body.pageId);
        if (!pageId)
          throw new UnprocessableEntityException({
            code: 'PAGE_REQUIRED',
            message: 'An internal page is required for an internal link',
            details: null,
          });
        const page = await this.prisma.page.findUnique({
          where: { id: pageId },
        });
        if (!page)
          throw new UnprocessableEntityException({
            code: 'PAGE_NOT_FOUND',
            message: 'The selected internal page no longer exists',
            details: null,
          });
        data.pageId = pageId;
        data.customUrl = null;
      }
    } else if (linkType === 'CUSTOM') {
      if (has('customUrl') || !options.partial) {
        const url = this.optionalText(body.customUrl);
        if (!url)
          throw new UnprocessableEntityException({
            code: 'URL_REQUIRED',
            message: 'A URL is required for an external or custom link',
            details: null,
          });
        if (!/^(\/[^\s]*|https:\/\/[^\s]+)$/.test(url))
          throw new UnprocessableEntityException({
            code: 'URL_INVALID',
            message:
              'The URL must be an internal path starting with "/" or an external "https://" address',
            details: null,
          });
        data.customUrl = url;
        data.pageId = null;
      }
    } else if (linkType === 'NONE') {
      data.pageId = null;
      data.customUrl = null;
    }

    if (has('openInNewTab')) data.openInNewTab = Boolean(body.openInNewTab);

    if (has('parentItemId')) {
      const parentItemId = this.optionalText(body.parentItemId);
      if (parentItemId) {
        if (parentItemId === options.existingId)
          throw new UnprocessableEntityException({
            code: 'PARENT_INVALID',
            message: 'An item cannot be its own parent',
            details: null,
          });
        const parent = await this.prisma.navigationItem.findFirst({
          where: { id: parentItemId, menuId },
        });
        if (!parent)
          throw new UnprocessableEntityException({
            code: 'PARENT_NOT_FOUND',
            message: 'The selected parent item is not in this menu',
            details: null,
          });
        // Only one level of nesting is ever rendered publicly
        // (navigationTree only walks parent -> children, not grandchildren),
        // so allowing a deeper parent would silently produce a link that
        // never appears on the live site.
        if (parent.parentItemId)
          throw new UnprocessableEntityException({
            code: 'PARENT_TOO_DEEP',
            message:
              'A sub-item cannot itself have a sub-item; only one level of nesting is supported',
            details: null,
          });
        data.parentItemId = parentItemId;
      } else {
        data.parentItemId = null;
      }
    }

    if (has('status')) {
      const status = typeof body.status === 'string' ? body.status : '';
      if (!['ACTIVE', 'INACTIVE'].includes(status))
        throw new UnprocessableEntityException({
          code: 'STATUS_INVALID',
          message: 'Status must be ACTIVE or INACTIVE',
          details: null,
        });
      data.status = status;
    }

    // Duplicate prevention: two items with the same label under the same
    // parent (including two top-level items) reads, once published, as one
    // link mysteriously duplicated in the header -- there is no legitimate
    // reason for it, so it is rejected rather than silently allowed.
    if (data.label !== undefined || has('parentItemId')) {
      const label =
        (data.label as string | undefined) ??
        (options.existingId
          ? (
              await this.prisma.navigationItem.findUnique({
                where: { id: options.existingId },
                select: { label: true },
              })
            )?.label
          : undefined);
      const parentItemId =
        data.parentItemId !== undefined
          ? (data.parentItemId as string | null)
          : options.existingId
            ? ((
                await this.prisma.navigationItem.findUnique({
                  where: { id: options.existingId },
                  select: { parentItemId: true },
                })
              )?.parentItemId ?? null)
            : null;
      if (label) {
        const duplicate = await this.prisma.navigationItem.findFirst({
          where: {
            menuId,
            parentItemId,
            label: { equals: label },
            ...(options.existingId ? { id: { not: options.existingId } } : {}),
          },
        });
        if (duplicate)
          throw new UnprocessableEntityException({
            code: 'LABEL_DUPLICATE',
            message: 'Another item in this menu already uses that label',
            details: null,
          });
      }
    }

    return data;
  }

  async navigationItemCreate(menuId: string, body: Data) {
    await this.requireMenu(menuId);
    const data = await this.validateNavigationItem(menuId, body, {
      partial: false,
    });
    const siblings = await this.prisma.navigationItem.count({
      where: {
        menuId,
        parentItemId: (data.parentItemId as string | null) ?? null,
      },
    });
    return this.prisma.navigationItem.create({
      data: {
        menuId,
        label: data.label as string,
        linkType: data.linkType as string,
        pageId: (data.pageId as string | null) ?? null,
        customUrl: (data.customUrl as string | null) ?? null,
        parentItemId: (data.parentItemId as string | null) ?? null,
        openInNewTab: Boolean(data.openInNewTab),
        status: (data.status as string) ?? 'ACTIVE',
        displayOrder: siblings,
      },
    });
  }

  async navigationItemUpdate(menuId: string, itemId: string, body: Data) {
    await this.requireMenu(menuId);
    const existing = await this.prisma.navigationItem.findFirst({
      where: { id: itemId, menuId },
    });
    if (!existing) this.notFound('navigation item');
    const data = await this.validateNavigationItem(menuId, body, {
      partial: true,
      existingId: itemId,
    });
    return this.prisma.navigationItem.update({ where: { id: itemId }, data });
  }

  /** A hard delete: NavigationItem has no `deletedAt` column, so "remove" and
   * "deactivate" are deliberately two different actions here -- Status =
   * INACTIVE is the reversible one (PATCH), this is not. Blocked when
   * children exist so removing a dropdown parent cannot silently orphan its
   * children; the admin has to move or remove them first. */
  async navigationItemDelete(menuId: string, itemId: string) {
    await this.requireMenu(menuId);
    const existing = await this.prisma.navigationItem.findFirst({
      where: { id: itemId, menuId },
    });
    if (!existing) this.notFound('navigation item');
    const children = await this.prisma.navigationItem.count({
      where: { parentItemId: itemId },
    });
    if (children)
      throw new ConflictException({
        code: 'ITEM_HAS_CHILDREN',
        message: "Remove or move this item's sub-items before deleting it",
        details: null,
      });
    await this.prisma.navigationItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  /** Bulk display-order write for one sibling group (a shared parentItemId,
   * or top-level when null). Every id must already belong to this menu and
   * this parent -- silently accepting an id from another menu or another
   * parent would let one reorder request move an item somewhere it was
   * never shown to be going. */
  async navigationItemReorder(
    menuId: string,
    parentItemId: string | null,
    orderedIds: string[],
  ) {
    await this.requireMenu(menuId);
    if (!orderedIds.length || new Set(orderedIds).size !== orderedIds.length)
      throw new UnprocessableEntityException({
        code: 'ORDER_INVALID',
        message:
          'The reorder list must be a non-empty list of distinct item ids',
        details: null,
      });
    const siblings = await this.prisma.navigationItem.findMany({
      where: { menuId, parentItemId },
      select: { id: true },
    });
    const siblingIds = new Set(siblings.map((row) => row.id));
    if (
      siblingIds.size !== orderedIds.length ||
      !orderedIds.every((id) => siblingIds.has(id))
    )
      throw new UnprocessableEntityException({
        code: 'ORDER_MISMATCH',
        message: "The reorder list must contain exactly this group's items",
        details: null,
      });
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.navigationItem.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );
    return this.navigationItems(menuId);
  }
  private requiredEmail(value: unknown) {
    const email = this.requiredText(value, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'A valid email is required',
        details: null,
      });
    return email;
  }
  private conflict(error: unknown) {
    if (
      typeof error === 'object' &&
      error &&
      (error as { code?: string }).code === 'P2002'
    )
      return new ConflictException({
        code: 'CONFLICT',
        message: 'A unique field already exists',
        details: null,
      });
    return error;
  }
  private notFound(resource: string): never {
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: `${resource} not found`,
      details: null,
    });
  }
}

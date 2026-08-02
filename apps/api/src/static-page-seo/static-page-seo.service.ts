import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OWNER_TYPE = 'staticPage';

/** Every code-defined (not database-record) public route the client asked
 * for SEO coverage on. Comparison pages default to robotsIndex:false so a
 * fresh row (nobody has edited it yet) is still noindex,follow -- matching
 * the "Comparison pages must remain noindex,follow" requirement without an
 * admin having to remember to set it. */
export const STATIC_PAGES: {
  key: string;
  label: string;
  defaultRobotsIndex: boolean;
}[] = [
  // ISS-026. No route reads this key: the homepage ("/") was merged into the
  // Countries Listing and calls staticPageMetadata('countries-listing', ...)
  // instead, matching the entry just below. A "Home" row here was still
  // editable in the admin with zero effect on any live page -- the same
  // "no route to attach to" defect fixed once already for cities-listing
  // (see its comment below), just never applied to this key.
  {
    key: 'countries-listing',
    label: 'Countries listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'universities-listing',
    label: 'Universities listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'subjects-listing',
    label: 'Subjects listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'courses-listing',
    label: 'Courses listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'scholarships-listing',
    label: 'Scholarships listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'consultants-listing',
    label: 'Consultants listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'careers-listing',
    label: 'Careers listing',
    defaultRobotsIndex: true,
  },
  { key: 'events-listing', label: 'Events listing', defaultRobotsIndex: true },
  {
    key: 'success-stories-listing',
    label: 'Success stories listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'testimonials-listing',
    label: 'Testimonials listing',
    defaultRobotsIndex: true,
  },
  { key: 'faq', label: 'FAQ page', defaultRobotsIndex: true },
  { key: 'about', label: 'About Us', defaultRobotsIndex: true },
  { key: 'contact', label: 'Contact Us', defaultRobotsIndex: true },
  {
    key: 'counselling',
    label: 'Book Free Counselling',
    defaultRobotsIndex: true,
  },
  {
    // Backs the real global /cities index. Previously registered as
    // "city-listing-base", which had no route to attach to.
    key: 'cities-listing',
    label: 'Cities listing',
    defaultRobotsIndex: true,
  },
  {
    key: 'compare-countries',
    label: 'Country comparison',
    defaultRobotsIndex: false,
  },
  {
    key: 'compare-universities',
    label: 'University comparison',
    defaultRobotsIndex: false,
  },
  {
    key: 'compare-courses',
    label: 'Course comparison',
    defaultRobotsIndex: false,
  },
  {
    key: 'compare-consultants',
    label: 'Consultant comparison',
    defaultRobotsIndex: false,
  },
];
const KEYS = new Set(STATIC_PAGES.map((p) => p.key));

@Injectable()
export class StaticPageSeoService {
  constructor(private readonly prisma: PrismaService) {}

  private definitionOrThrow(key: string) {
    const definition = STATIC_PAGES.find((p) => p.key === key);
    if (!definition)
      throw new NotFoundException({
        code: 'STATIC_PAGE_NOT_FOUND',
        message: `Unknown static page "${key}"`,
        details: null,
      });
    return definition;
  }

  async adminList() {
    const rows = await this.prisma.seoMetadata.findMany({
      where: { ownerType: OWNER_TYPE, ownerId: { in: [...KEYS] } },
      include: { ogMedia: true, twitterMedia: true },
    });
    const byKey = new Map(rows.map((row) => [row.ownerId, row]));
    return STATIC_PAGES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      seo: byKey.get(definition.key) ?? null,
    }));
  }

  async publicGet(key: string) {
    if (!KEYS.has(key)) return null;
    return this.prisma.seoMetadata.findUnique({
      where: { ownerType_ownerId: { ownerType: OWNER_TYPE, ownerId: key } },
      include: { ogMedia: true, twitterMedia: true },
    });
  }

  async save(key: string, body: Record<string, unknown>) {
    const definition = this.definitionOrThrow(key);
    const text = (value: unknown) =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
    const seoTitle = text(body.seoTitle);
    const metaDescription = text(body.metaDescription);
    if (!seoTitle || !metaDescription)
      throw new BadRequestException({
        code: 'SEO_FIELDS_REQUIRED',
        message: 'seoTitle and metaDescription are required',
        details: null,
      });
    const shared = {
      seoTitle,
      metaDescription,
      canonicalUrl: text(body.canonicalUrl),
      focusKeyword: text(body.focusKeyword),
      ogTitle: text(body.ogTitle),
      ogDescription: text(body.ogDescription),
      ogMediaId: text(body.ogMediaId),
      twitterTitle: text(body.twitterTitle),
      twitterDescription: text(body.twitterDescription),
      twitterMediaId: text(body.twitterMediaId),
      robotsIndex:
        body.robotsIndex === undefined
          ? definition.defaultRobotsIndex
          : body.robotsIndex !== false,
      robotsFollow: body.robotsFollow !== false,
    };
    return this.prisma.seoMetadata.upsert({
      where: { ownerType_ownerId: { ownerType: OWNER_TYPE, ownerId: key } },
      update: shared,
      create: { ownerType: OWNER_TYPE, ownerId: key, ...shared },
      include: { ogMedia: true, twitterMedia: true },
    });
  }
}

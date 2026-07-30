import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** The Website Builder page selector.
 *
 * A Phase 1 public page is managed in one of three ways, and an admin should
 * not have to know which:
 *
 *  - PAGE      a CMS Page record whose sections are edited directly
 *              (Home, About, Contact, FAQ, and the listing pages that have a
 *              matching Page record for their editorial copy).
 *  - TEMPLATE  a reusable layout applied to every record of one type
 *              (University Detail, Scholarship Detail, ...). Entity data still
 *              comes from the University/Scholarship/... record; the template
 *              owns layout and presentation only.
 *  - ROUTE     a code-defined route whose composition is fixed, but whose SEO
 *              (title, description, canonical, robots) is Admin-managed.
 *
 * This registry is the single list behind the Website Pages dropdown, so every
 * managed page is reachable without typing a URL. `kind` is reported honestly
 * per entry so the UI can say what is editable rather than implying that every
 * page has a full section editor. */

export type PageFamily =
  | 'Core'
  | 'Destinations'
  | 'Universities'
  | 'Academics'
  | 'Scholarships'
  | 'Consultants'
  | 'Comparison'
  | 'Content';

type RegistryEntry = {
  key: string;
  label: string;
  family: PageFamily;
  /** Public URL, or a representative one for templates. */
  publicPath: string;
  /** Slug of the CMS Page that owns this page's editorial sections, when one
   * exists. Resolved to a real record id at request time. */
  pageSlug?: string;
  /** templateKey of the PageTemplate that owns this page's layout. */
  templateKey?: string;
  /** static-page SEO key, when SEO is managed by the static-page registry. */
  seoKey?: string;
};

export const WEBSITE_PAGES: RegistryEntry[] = [
  { key: 'home', label: 'Home', family: 'Core', publicPath: '/', pageSlug: 'home', seoKey: 'home' },
  { key: 'about', label: 'About Us', family: 'Core', publicPath: '/about', pageSlug: 'about' },
  { key: 'contact', label: 'Contact Us', family: 'Core', publicPath: '/contact' },
  { key: 'counselling', label: 'Book Free Counselling', family: 'Core', publicPath: '/counselling' },
  { key: 'faq', label: 'FAQ', family: 'Core', publicPath: '/faq', pageSlug: 'faq', seoKey: 'faq' },

  { key: 'countries-listing', label: 'Countries Listing', family: 'Destinations', publicPath: '/countries', pageSlug: 'countries', seoKey: 'countries-listing' },
  { key: 'country-detail', label: 'Country Detail Template', family: 'Destinations', publicPath: '/study-in-canada', templateKey: 'country-detail' },
  { key: 'cities-listing', label: 'Cities Listing', family: 'Destinations', publicPath: '/cities', seoKey: 'cities-listing' },
  { key: 'city-detail', label: 'City Detail Template', family: 'Destinations', publicPath: '/study-in-canada/demo-city', templateKey: 'city-detail' },

  { key: 'universities-listing', label: 'Universities Listing', family: 'Universities', publicPath: '/universities', seoKey: 'universities-listing' },
  { key: 'university-detail', label: 'University Detail Template', family: 'Universities', publicPath: '/universities', templateKey: 'university-detail' },
  { key: 'university-courses', label: 'University Courses Template', family: 'Universities', publicPath: '/universities', templateKey: 'university-courses' },
  { key: 'university-course-offering', label: 'Single University Course Offering Template', family: 'Universities', publicPath: '/universities', templateKey: 'university-course-offering' },

  { key: 'subjects-listing', label: 'Subject Listing', family: 'Academics', publicPath: '/subjects', seoKey: 'subjects-listing' },
  { key: 'subject-detail', label: 'Subject Detail Template', family: 'Academics', publicPath: '/subjects', templateKey: 'subject-detail' },
  { key: 'specializations-listing', label: 'Specialization Listing', family: 'Academics', publicPath: '/subjects' },
  { key: 'courses-listing', label: 'Generic Courses Listing', family: 'Academics', publicPath: '/courses', seoKey: 'courses-listing' },
  { key: 'course-detail', label: 'Generic Course Detail Template', family: 'Academics', publicPath: '/courses', templateKey: 'course-detail' },

  { key: 'scholarships-listing', label: 'Scholarship Listing', family: 'Scholarships', publicPath: '/scholarships', seoKey: 'scholarships-listing' },
  { key: 'scholarship-detail', label: 'Scholarship Detail Template', family: 'Scholarships', publicPath: '/scholarships', templateKey: 'scholarship-detail' },

  { key: 'consultants-listing', label: 'Consultants Listing', family: 'Consultants', publicPath: '/study-abroad-consultants', seoKey: 'consultants-listing' },
  { key: 'consultant-detail', label: 'Consultant Detail Template', family: 'Consultants', publicPath: '/study-abroad-consultants', templateKey: 'consultant-detail' },
  { key: 'consultant-location', label: 'Consultant Location Template', family: 'Consultants', publicPath: '/study-abroad-consultants', templateKey: 'consultant-location' },

  { key: 'compare-countries', label: 'Country Comparison', family: 'Comparison', publicPath: '/compare/countries', seoKey: 'compare-countries' },
  { key: 'compare-universities', label: 'University Comparison', family: 'Comparison', publicPath: '/compare/universities', seoKey: 'compare-universities' },
  { key: 'compare-courses', label: 'Course Comparison', family: 'Comparison', publicPath: '/compare/courses', seoKey: 'compare-courses' },
  { key: 'compare-consultants', label: 'Consultant Comparison', family: 'Comparison', publicPath: '/compare/consultants', seoKey: 'compare-consultants' },

  { key: 'success-stories', label: 'Success Stories', family: 'Content', publicPath: '/success-stories', seoKey: 'success-stories-listing' },
  { key: 'testimonials', label: 'Testimonials', family: 'Content', publicPath: '/testimonials', seoKey: 'testimonials-listing' },
  { key: 'careers', label: 'Careers', family: 'Content', publicPath: '/careers', seoKey: 'careers-listing' },
  { key: 'job-detail', label: 'Job Detail Template', family: 'Content', publicPath: '/careers', templateKey: 'job-detail' },
  { key: 'events-listing', label: 'Events Listing', family: 'Content', publicPath: '/events', seoKey: 'events-listing' },
  { key: 'event-detail', label: 'Event Detail Template', family: 'Content', publicPath: '/events', templateKey: 'event-detail' },
];

@Injectable()
export class WebsitePagesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [pages, templates, seoRows] = await Promise.all([
      this.prisma.page.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          updatedAt: true,
          _count: { select: { sections: true } },
        },
      }),
      this.prisma.pageTemplate.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          templateKey: true,
          name: true,
          isActive: true,
          updatedAt: true,
        },
      }),
      this.prisma.seoMetadata.findMany({
        where: { ownerType: 'staticPage' },
        select: { ownerId: true, updatedAt: true },
      }),
    ]);

    const pageBySlug = new Map(pages.map((row) => [row.slug, row]));
    const templateByKey = new Map(templates.map((row) => [row.templateKey, row]));
    const seoByKey = new Map(seoRows.map((row) => [row.ownerId, row]));

    return WEBSITE_PAGES.map((entry) => {
      const page = entry.pageSlug ? pageBySlug.get(entry.pageSlug) : undefined;
      const template = entry.templateKey
        ? templateByKey.get(entry.templateKey)
        : undefined;
      const seo = entry.seoKey ? seoByKey.get(entry.seoKey) : undefined;

      // A page with a real CMS record is section-editable; otherwise a
      // template record owns its layout; otherwise only SEO is managed.
      const kind = page ? 'PAGE' : template ? 'TEMPLATE' : 'ROUTE';
      const status = page
        ? page.status
        : template
          ? template.isActive
            ? 'ACTIVE'
            : 'INACTIVE'
          : 'CODE_DEFINED';

      return {
        key: entry.key,
        label: entry.label,
        family: entry.family,
        kind,
        status,
        publicPath: entry.publicPath,
        pageId: page?.id ?? null,
        pageSlug: entry.pageSlug ?? null,
        sectionCount: page?._count.sections ?? null,
        templateId: template?.id ?? null,
        templateKey: entry.templateKey ?? null,
        seoKey: entry.seoKey ?? null,
        hasSeoRecord: Boolean(seo),
        updatedAt: page?.updatedAt ?? template?.updatedAt ?? seo?.updatedAt ?? null,
        /** Whether this entry can be created as a CMS page on demand. */
        canCreatePage: Boolean(entry.pageSlug) && !page,
      };
    });
  }

  /** Creates the backing CMS Page for a registry entry that declares a slug but
   * has no record yet, so an admin can start editing its sections without
   * hand-creating a page with exactly the right slug. */
  async ensurePage(key: string, actorUserId?: string) {
    const entry = WEBSITE_PAGES.find((row) => row.key === key);
    if (!entry?.pageSlug) return null;
    const existing = await this.prisma.page.findFirst({
      where: { slug: entry.pageSlug, deletedAt: null },
    });
    if (existing) return existing;
    return this.prisma.page.create({
      data: {
        pageType: 'STANDARD',
        title: entry.label,
        slug: entry.pageSlug,
        status: 'DRAFT',
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
  }
}

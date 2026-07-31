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

/** How a page is managed, in the client's vocabulary rather than ours.
 *
 *  - STATIC_PAGE      editorial page with its own content (Home, About, FAQ)
 *  - LISTING_PAGE     a code-composed index whose editorial framing (hero,
 *                     intro, CTA band) is Admin-managed, while the rows keep
 *                     coming from the real entity records
 *  - DETAIL_TEMPLATE  layout applied to every record of one type
 *  - FUNCTIONAL_PAGE  a page built around a form or tool; only safe
 *                     configurable blocks are exposed, never the mechanism
 *  - COMPARISON_PAGE  a comparison route, framing managed the same way as a
 *                     listing */
export type ManagementType =
  | 'STATIC_PAGE'
  | 'LISTING_PAGE'
  | 'DETAIL_TEMPLATE'
  | 'FUNCTIONAL_PAGE'
  | 'COMPARISON_PAGE';

type RegistryEntry = {
  key: string;
  label: string;
  family: PageFamily;
  managementType: ManagementType;
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
  {
    key: 'home',
    managementType: 'STATIC_PAGE',
    label: 'Home',
    family: 'Core',
    publicPath: '/',
    pageSlug: 'home',
    seoKey: 'home',
  },
  {
    key: 'about',
    managementType: 'STATIC_PAGE',
    label: 'About Us',
    family: 'Core',
    publicPath: '/about',
    pageSlug: 'about',
    seoKey: 'about',
  },
  {
    key: 'contact',
    managementType: 'FUNCTIONAL_PAGE',
    label: 'Contact Us',
    family: 'Core',
    pageSlug: 'contact',
    publicPath: '/contact',
    seoKey: 'contact',
  },
  {
    key: 'counselling',
    managementType: 'FUNCTIONAL_PAGE',
    label: 'Book Free Counselling',
    family: 'Core',
    pageSlug: 'counselling',
    publicPath: '/counselling',
    seoKey: 'counselling',
  },
  {
    key: 'faq',
    managementType: 'STATIC_PAGE',
    label: 'FAQ',
    family: 'Core',
    publicPath: '/faq',
    pageSlug: 'faq',
    seoKey: 'faq',
  },

  {
    key: 'countries-listing',
    managementType: 'LISTING_PAGE',
    label: 'Countries Listing',
    family: 'Destinations',
    publicPath: '/countries',
    pageSlug: 'countries',
    seoKey: 'countries-listing',
  },
  {
    key: 'country-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Country Detail Template',
    family: 'Destinations',
    publicPath: '/study-in/[country]',
    templateKey: 'country-detail',
  },
  {
    key: 'cities-listing',
    managementType: 'LISTING_PAGE',
    label: 'Cities Listing',
    family: 'Destinations',
    pageSlug: 'cities-listing',
    publicPath: '/cities',
    seoKey: 'cities-listing',
  },
  {
    key: 'city-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'City Detail Template',
    family: 'Destinations',
    publicPath: '/study-in/[country]/[city]',
    templateKey: 'city-detail',
  },

  {
    key: 'universities-listing',
    managementType: 'LISTING_PAGE',
    label: 'Universities Listing',
    family: 'Universities',
    pageSlug: 'universities-listing',
    publicPath: '/universities',
    seoKey: 'universities-listing',
  },
  {
    key: 'university-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'University Detail Template',
    family: 'Universities',
    publicPath: '/universities/[university]',
    templateKey: 'university-detail',
  },
  {
    key: 'university-courses',
    managementType: 'DETAIL_TEMPLATE',
    label: 'University Courses Template',
    family: 'Universities',
    publicPath: '/universities/[university]/courses',
    templateKey: 'university-courses',
  },
  {
    key: 'university-course-offering',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Single University Course Offering Template',
    family: 'Universities',
    publicPath: '/universities/[university]/courses/[offering]',
    templateKey: 'university-course-offering',
  },

  {
    key: 'subjects-listing',
    managementType: 'LISTING_PAGE',
    label: 'Subjects Listing',
    family: 'Academics',
    pageSlug: 'subjects-listing',
    publicPath: '/subjects',
    seoKey: 'subjects-listing',
  },
  {
    key: 'subject-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Subject Detail Template',
    family: 'Academics',
    publicPath: '/subjects/[subject]',
    templateKey: 'subject-detail',
  },
  // Per-subject route (/subjects/{slug}/specializations), so its presentation
  // is owned by a template rather than one static SEO record.
  {
    key: 'specializations-listing',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Specializations Listing',
    family: 'Academics',
    publicPath: '/subjects/[subject]/specializations',
    templateKey: 'specialization-listing',
  },
  {
    key: 'courses-listing',
    managementType: 'LISTING_PAGE',
    label: 'Generic Courses Listing',
    family: 'Academics',
    pageSlug: 'courses-listing',
    publicPath: '/courses',
    seoKey: 'courses-listing',
  },
  {
    key: 'course-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Generic Course Detail Template',
    family: 'Academics',
    publicPath: '/courses/[course]',
    templateKey: 'course-detail',
  },

  {
    key: 'scholarships-listing',
    managementType: 'LISTING_PAGE',
    label: 'Scholarships Listing',
    family: 'Scholarships',
    pageSlug: 'scholarships-listing',
    publicPath: '/scholarships',
    seoKey: 'scholarships-listing',
  },
  {
    key: 'scholarship-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Scholarship Detail Template',
    family: 'Scholarships',
    publicPath: '/scholarships/[scholarship]',
    templateKey: 'scholarship-detail',
  },

  {
    key: 'consultants-listing',
    managementType: 'LISTING_PAGE',
    label: 'Consultants Listing',
    family: 'Consultants',
    pageSlug: 'consultants-listing',
    publicPath: '/study-abroad-consultants',
    seoKey: 'consultants-listing',
  },
  {
    key: 'consultant-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Consultant Detail Template',
    family: 'Consultants',
    publicPath: '/study-abroad-consultants/[consultant]',
    templateKey: 'consultant-detail',
  },
  {
    key: 'consultant-location',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Consultant Location Template',
    family: 'Consultants',
    publicPath: '/study-abroad-consultants/locations/[location]',
    templateKey: 'consultant-location',
  },

  {
    key: 'compare-countries',
    managementType: 'COMPARISON_PAGE',
    label: 'Country Comparison',
    family: 'Comparison',
    pageSlug: 'compare-countries',
    publicPath: '/compare/countries',
    seoKey: 'compare-countries',
  },
  {
    key: 'compare-universities',
    managementType: 'COMPARISON_PAGE',
    label: 'University Comparison',
    family: 'Comparison',
    pageSlug: 'compare-universities',
    publicPath: '/compare/universities',
    seoKey: 'compare-universities',
  },
  {
    key: 'compare-courses',
    managementType: 'COMPARISON_PAGE',
    label: 'Course Comparison',
    family: 'Comparison',
    pageSlug: 'compare-courses',
    publicPath: '/compare/courses',
    seoKey: 'compare-courses',
  },
  {
    key: 'compare-consultants',
    managementType: 'COMPARISON_PAGE',
    label: 'Consultant Comparison',
    family: 'Comparison',
    pageSlug: 'compare-consultants',
    publicPath: '/compare/consultants',
    seoKey: 'compare-consultants',
  },

  {
    key: 'success-stories',
    managementType: 'LISTING_PAGE',
    label: 'Success Stories',
    family: 'Content',
    pageSlug: 'success-stories-listing',
    publicPath: '/success-stories',
    seoKey: 'success-stories-listing',
  },
  {
    key: 'testimonials',
    managementType: 'LISTING_PAGE',
    label: 'Testimonials',
    family: 'Content',
    pageSlug: 'testimonials-listing',
    publicPath: '/testimonials',
    seoKey: 'testimonials-listing',
  },
  {
    key: 'careers',
    managementType: 'LISTING_PAGE',
    label: 'Careers Listing',
    family: 'Content',
    pageSlug: 'careers-listing',
    publicPath: '/careers',
    seoKey: 'careers-listing',
  },
  {
    key: 'job-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Job Detail Template',
    family: 'Content',
    publicPath: '/careers/[job]',
    templateKey: 'job-detail',
  },
  {
    key: 'events-listing',
    managementType: 'LISTING_PAGE',
    label: 'Events Listing',
    family: 'Content',
    pageSlug: 'events-listing',
    publicPath: '/events',
    seoKey: 'events-listing',
  },
  {
    key: 'event-detail',
    managementType: 'DETAIL_TEMPLATE',
    label: 'Event Detail Template',
    family: 'Content',
    publicPath: '/events/[event]',
    templateKey: 'event-detail',
  },
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
    const templateByKey = new Map(
      templates.map((row) => [row.templateKey, row]),
    );
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
      // Where the admin should be sent to edit this entry. Both kinds land in
      // the same consolidated Builder workspace.
      const builderPath = page
        ? `/website/pages/${page.id}/builder`
        : template
          ? `/website/templates/${template.id}/builder`
          : null;
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
        managementType: entry.managementType,
        kind,
        builderPath,
        status,
        publicPath: entry.publicPath,
        pageId: page?.id ?? null,
        pageSlug: entry.pageSlug ?? null,
        sectionCount: page?._count.sections ?? null,
        templateId: template?.id ?? null,
        templateKey: entry.templateKey ?? null,
        seoKey: entry.seoKey ?? null,
        hasSeoRecord: Boolean(seo),
        updatedAt:
          page?.updatedAt ?? template?.updatedAt ?? seo?.updatedAt ?? null,
        /** Whether this entry can be created as a CMS page on demand. */
        canCreatePage: Boolean(entry.pageSlug) && !page,
      };
    });
  }

  /** Real published entities an admin can preview a dynamic template with.
   *
   * The list comes from the actual records, never from fixtures: previewing a
   * template is only meaningful against content that really exists, and the
   * resulting URL is the genuine public route for that entity. */
  async previewEntities(templateKey: string) {
    const take = 25;
    const pub = { status: 'PUBLISHED' as const, deletedAt: null };
    const map = async (): Promise<Array<{ label: string; path: string }>> => {
      switch (templateKey) {
        case 'university-detail':
          return (
            await this.prisma.university.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({ label: r.name, path: `/universities/${r.slug}` }));
        case 'university-courses':
          return (
            await this.prisma.university.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({
            label: `${r.name} — courses`,
            path: `/universities/${r.slug}/courses`,
          }));
        case 'university-course-offering':
          return (
            await this.prisma.universityCourseOffering.findMany({
              where: { ...pub },
              take,
              select: {
                name: true,
                slug: true,
                university: { select: { slug: true, name: true } },
              },
            })
          )
            .filter((r) => r.university?.slug)
            .map((r) => ({
              label: `${r.university.name} — ${r.name}`,
              path: `/universities/${r.university.slug}/courses/${r.slug}`,
            }));
        case 'country-detail':
          return (
            await this.prisma.country.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({ label: r.name, path: `/study-in/${r.slug}` }));
        case 'city-detail':
          return (
            await this.prisma.city.findMany({
              where: { deletedAt: null },
              take,
              orderBy: { name: 'asc' },
              select: {
                name: true,
                slug: true,
                country: { select: { slug: true } },
              },
            })
          )
            .filter((r) => r.country?.slug)
            .map((r) => ({
              label: r.name,
              path: `/study-in/${r.country.slug}/${r.slug}`,
            }));
        case 'subject-detail':
          return (
            await this.prisma.subject.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({ label: r.name, path: `/subjects/${r.slug}` }));
        case 'specialization-listing':
          return (
            await this.prisma.subject.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({
            label: `${r.name} — specializations`,
            path: `/subjects/${r.slug}/specializations`,
          }));
        case 'course-detail':
          return (
            await this.prisma.course.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({ label: r.name, path: `/courses/${r.slug}` }));
        case 'scholarship-detail':
          return (
            await this.prisma.scholarship.findMany({
              where: pub,
              take,
              orderBy: { title: 'asc' },
              select: { title: true, slug: true },
            })
          ).map((r) => ({ label: r.title, path: `/scholarships/${r.slug}` }));
        case 'consultant-detail':
          return (
            await this.prisma.consultant.findMany({
              where: pub,
              take,
              orderBy: { name: 'asc' },
              select: { name: true, slug: true },
            })
          ).map((r) => ({
            label: r.name,
            path: `/study-abroad-consultants/${r.slug}`,
          }));
        case 'consultant-location':
          return (
            await this.prisma.consultantLocation.findMany({
              where: { deletedAt: null },
              take,
              select: { name: true, slug: true },
            })
          ).map((r) => ({
            label: r.name,
            path: `/study-abroad-consultants/locations/${r.slug}`,
          }));
        case 'job-detail':
          return (
            await this.prisma.job.findMany({
              where: pub,
              take,
              orderBy: { title: 'asc' },
              select: { title: true, slug: true },
            })
          ).map((r) => ({ label: r.title, path: `/careers/${r.slug}` }));
        case 'event-detail':
          return (
            await this.prisma.event.findMany({
              where: pub,
              take,
              orderBy: { title: 'asc' },
              select: { title: true, slug: true },
            })
          ).map((r) => ({ label: r.title, path: `/events/${r.slug}` }));
        default:
          return [];
      }
    };
    return map();
  }

  /** Creates the backing records for every registry entry that needs one.
   *
   * Deterministic and idempotent: keyed on the registry's own slug and
   * templateKey, so running it repeatedly converges on the same rows and never
   * duplicates. It is what makes every required Phase 1 route appear in the
   * selector without an admin having to press "Create editable page" first.
   *
   * A Page record here is a *content* record, not a route. Nothing renders a
   * page by looking its slug up as a URL, so registering `universities-listing`
   * adds no public URL -- `/universities` stays the one and only listing route,
   * and its rows keep coming from the University records. */
  async registerAll(actorUserId?: string) {
    const created: string[] = [];
    const existing: string[] = [];
    for (const entry of WEBSITE_PAGES) {
      if (!entry.pageSlug) continue;
      const found = await this.prisma.page.findFirst({
        where: { slug: entry.pageSlug, deletedAt: null },
        select: { id: true },
      });
      if (found) {
        existing.push(entry.key);
        continue;
      }
      await this.prisma.page.create({
        data: {
          pageType: entry.managementType,
          title: entry.label,
          slug: entry.pageSlug,
          shortDescription: null,
          // Registered pages start PUBLISHED because the public route they
          // frame is already live; a DRAFT here would imply the route is not.
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
        },
      });
      created.push(entry.key);
    }
    return { created, existing, total: WEBSITE_PAGES.length };
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

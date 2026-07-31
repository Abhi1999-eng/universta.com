import { WEBSITE_PAGES } from './website-pages.service';

/** Website Builder registration for a normal (non-demo) deployment.
 *
 * Every approved Phase 1 route needs a backing record before it can be opened
 * in the Builder: a Page for static/listing/functional/comparison routes, a
 * PageTemplate for dynamic detail routes. These are *structural* records --
 * they carry no catalogue content and describe no fictional institution, so
 * they belong in the foundation seed that every environment runs, not in the
 * demo catalogue seed.
 *
 * Safety rules, because this runs against populated production databases:
 *
 *  - create-if-missing only. Nothing here updates or deletes an existing row,
 *    so a page whose content an admin has customised is never touched.
 *  - keyed on the registry's own slug / templateKey, so repeat runs converge
 *    and create nothing the second time.
 *  - a registered Page is a content record, not a route. Nothing resolves a
 *    URL by page slug, so registering `universities-listing` adds no public
 *    URL and cannot shadow an existing one.
 */

/** Minimal Prisma surface this needs, so the module can be used from a seed
 * script or from Nest without dragging in either one's client type. */
type RegistrationClient = {
  page: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  pageTemplate: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

type TemplateDefinition = {
  templateKey: string;
  name: string;
  pageFamily: string;
  description: string;
  sections: ReadonlyArray<readonly [string, string, string]>;
};

/** Layout definitions for the dynamic detail templates. Section composition
 * only -- the entity data always comes from the University/Scholarship/...
 * record itself. */
export const PAGE_TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    templateKey: 'country-detail',
    name: 'Country Detail',
    pageFamily: 'Destinations',
    description: 'Layout applied to every published country page.',
    sections: [
      ['hero', 'HERO', 'Country hero'],
      ['at-a-glance', 'STATS', 'At a glance'],
      ['overview', 'RICH_TEXT', 'Why study here'],
      ['universities', 'UNIVERSITY_DIRECTORY', 'Universities'],
      ['cities', 'RELATED_LINKS', 'Cities'],
      ['faq', 'FAQ_GROUP', 'Frequently asked questions'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'city-detail',
    name: 'City Detail',
    pageFamily: 'Destinations',
    description: 'Layout applied to every published city page.',
    sections: [
      ['hero', 'HERO', 'City hero'],
      ['overview', 'RICH_TEXT', 'About this city'],
      ['universities', 'UNIVERSITY_DIRECTORY', 'Universities here'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'university-detail',
    name: 'University Detail',
    pageFamily: 'Universities',
    description: 'Layout applied to every published university profile.',
    sections: [
      ['hero', 'HERO', 'University hero'],
      ['quick-facts', 'STATS', 'Quick facts'],
      ['overview', 'RICH_TEXT', 'Overview'],
      ['campuses', 'CARD_GRID', 'Campuses'],
      ['accreditations', 'RELATED_LINKS', 'Accreditations'],
      ['offerings', 'COURSE_DIRECTORY', 'Course offerings'],
      ['scholarships', 'SCHOLARSHIP_DIRECTORY', 'Scholarships'],
      ['related', 'RELATED_LINKS', 'Related links'],
      ['claim', 'CTA', 'Claim this university'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'university-courses',
    name: 'University Courses',
    pageFamily: 'Universities',
    description: "Layout for a university's course offering listing.",
    sections: [
      ['hero', 'HERO', 'Courses hero'],
      ['offerings', 'COURSE_DIRECTORY', 'Course offerings'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'university-course-offering',
    name: 'Single University Course Offering',
    pageFamily: 'Universities',
    description: 'Layout for one university course offering.',
    sections: [
      ['hero', 'HERO', 'Offering hero'],
      ['at-a-glance', 'STATS', 'At a glance'],
      ['overview', 'RICH_TEXT', 'What to know'],
      ['related', 'RELATED_LINKS', 'Related offerings'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'subject-detail',
    name: 'Subject Detail',
    pageFamily: 'Academics',
    description: 'Layout applied to every published subject page.',
    sections: [
      ['hero', 'HERO', 'Subject hero'],
      ['at-a-glance', 'STATS', 'At a glance'],
      ['overview', 'RICH_TEXT', 'About this subject'],
      ['specializations', 'CARD_GRID', 'Specializations'],
      ['courses', 'COURSE_DIRECTORY', 'Popular courses'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'specialization-listing',
    name: 'Specialization Listing',
    pageFamily: 'Academics',
    description: "Layout for a subject's specialization listing.",
    sections: [
      ['hero', 'HERO', 'Specializations hero'],
      ['specializations', 'CARD_GRID', 'Specializations'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'course-detail',
    name: 'Generic Course Detail',
    pageFamily: 'Academics',
    description: 'Layout applied to every published generic course.',
    sections: [
      ['hero', 'HERO', 'Course hero'],
      ['at-a-glance', 'STATS', 'At a glance'],
      ['overview', 'RICH_TEXT', 'Course overview'],
      ['related', 'RELATED_LINKS', 'Related courses'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'scholarship-detail',
    name: 'Scholarship Detail',
    pageFamily: 'Scholarships',
    description: 'Layout applied to every published scholarship.',
    sections: [
      ['hero', 'HERO', 'Scholarship hero'],
      ['at-a-glance', 'STATS', 'At a glance'],
      ['overview', 'RICH_TEXT', 'What to know'],
      ['related', 'RELATED_LINKS', 'Related scholarships'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'consultant-detail',
    name: 'Consultant Detail',
    pageFamily: 'Consultants',
    description: 'Layout applied to every published consultant profile.',
    sections: [
      ['hero', 'HERO', 'Consultant hero'],
      ['overview', 'RICH_TEXT', 'About this consultant'],
      ['services', 'CARD_GRID', 'Services'],
      ['locations', 'RELATED_LINKS', 'Locations'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'consultant-location',
    name: 'Consultant Location',
    pageFamily: 'Consultants',
    description: 'Layout applied to every published consultant location.',
    sections: [
      ['hero', 'HERO', 'Location hero'],
      ['consultants', 'CONSULTANT_DIRECTORY', 'Consultants here'],
      ['counselling', 'LEAD_GENERATION', 'Talk to a counsellor'],
    ],
  },
  {
    templateKey: 'job-detail',
    name: 'Job Detail',
    pageFamily: 'Content',
    description: 'Layout applied to every published job posting.',
    sections: [
      ['hero', 'HERO', 'Job hero'],
      ['overview', 'RICH_TEXT', 'Role overview'],
      ['related', 'RELATED_LINKS', 'Other openings'],
    ],
  },
  {
    templateKey: 'event-detail',
    name: 'Event Detail',
    pageFamily: 'Content',
    description: 'Layout applied to every published event.',
    sections: [
      ['hero', 'HERO', 'Event hero'],
      ['overview', 'RICH_TEXT', 'Event details'],
      ['related', 'RELATED_LINKS', 'Other events'],
    ],
  },
];

export type RegistrationResult = {
  pagesCreated: string[];
  pagesExisting: number;
  templatesCreated: string[];
  templatesExisting: number;
};

/** Idempotent. Returns what it actually had to create, so a caller (or a
 * deploy log) can show "nothing to do" on a repeat run. */
export async function registerWebsiteBuilderRecords(
  prisma: RegistrationClient,
  actorUserId?: string | null,
): Promise<RegistrationResult> {
  const result: RegistrationResult = {
    pagesCreated: [],
    pagesExisting: 0,
    templatesCreated: [],
    templatesExisting: 0,
  };

  for (const entry of WEBSITE_PAGES) {
    if (!entry.pageSlug) continue;
    // Matched on slug alone, not `deletedAt: null`: slug is unique, so a
    // soft-deleted row still occupies the key. Skipping it is correct twice
    // over -- creating would throw, and resurrecting would undo a deliberate
    // admin deletion.
    const existing = await prisma.page.findFirst({
      where: { slug: entry.pageSlug },
      select: { id: true },
    });
    if (existing) {
      result.pagesExisting += 1;
      continue;
    }
    await prisma.page.create({
      data: {
        pageType: entry.managementType,
        title: entry.label,
        slug: entry.pageSlug,
        // Published because the public route it frames is already live; a
        // DRAFT here would wrongly imply the route is not.
        status: 'PUBLISHED',
        publishedAt: new Date(),
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
    result.pagesCreated.push(entry.pageSlug);
  }

  for (const template of PAGE_TEMPLATE_DEFINITIONS) {
    const existing = await prisma.pageTemplate.findFirst({
      where: { templateKey: template.templateKey },
      select: { id: true },
    });
    if (existing) {
      // Deliberately not an upsert: overwriting defaultSectionsJson would
      // discard an admin's customised layout on every deploy.
      result.templatesExisting += 1;
      continue;
    }
    await prisma.pageTemplate.create({
      data: {
        templateKey: template.templateKey,
        name: template.name,
        pageFamily: template.pageFamily,
        description: template.description,
        defaultSectionsJson: template.sections.map(
          ([sectionKey, sectionType, heading], index) => ({
            sectionKey,
            sectionType,
            heading,
            displayOrder: index,
          }),
        ),
        isActive: true,
        createdByUserId: actorUserId ?? null,
        updatedByUserId: actorUserId ?? null,
      },
    });
    result.templatesCreated.push(template.templateKey);
  }

  return result;
}

export function describeRegistration(result: RegistrationResult): string {
  const created = result.pagesCreated.length + result.templatesCreated.length;
  if (created === 0)
    return `Website Builder already registered (${result.pagesExisting} pages, ${result.templatesExisting} templates) - no changes.`;
  return `Website Builder registered ${result.pagesCreated.length} page(s) and ${result.templatesCreated.length} template(s); ${result.pagesExisting} page(s) and ${result.templatesExisting} template(s) already present.`;
}

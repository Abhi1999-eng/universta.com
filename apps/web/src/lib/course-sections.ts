import type { CourseDetail } from './catalog';

/**
 * A course's content sections, as the pages that print them read them.
 *
 * The admin offers eight kinds of section -- curriculum, skills, admission
 * requirements, documents, career outcomes, the application process, the
 * sources and a counselling call -- and saves each body in the shape its
 * type asks for: a rich-text section as `paragraphs`, a checklist as
 * `items` (with the same lines as one paragraph), a set of steps as
 * `steps`. The guide used to look for three keys, two of which the admin
 * cannot save, so everything but the curriculum stayed off the site.
 *
 * Each reader here returns what is actually there and nothing else: a
 * checklist with no items falls back to its paragraphs, so text an editor
 * wrote is never dropped for being in the other shape.
 */
export type CourseSection = CourseDetail['contentSections'][number];

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((line): line is string => typeof line === 'string')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

/** The section's paragraphs: rich text for a rich-text section, the plain
 *  lines of a checklist or steps section as the admin also keeps them. */
export function sectionParagraphs(section: CourseSection | null | undefined): string[] {
  return strings(section?.bodyJson?.paragraphs);
}

/** The steps of a section, in the order an editor numbered them. */
export function sectionSteps(section: CourseSection | null | undefined): string[] {
  const steps = section?.bodyJson?.steps;
  if (Array.isArray(steps)) {
    const rows = steps
      .map((step, index) =>
        step && typeof step === 'object'
          ? {
              text:
                typeof (step as { text?: unknown }).text === 'string'
                  ? (step as { text: string }).text.trim()
                  : '',
              order: Number((step as { order?: unknown }).order ?? index + 1),
              index,
            }
          : typeof step === 'string'
            ? { text: step.trim(), order: index + 1, index }
            : null,
      )
      .filter((row): row is { text: string; order: number; index: number } =>
        Boolean(row?.text),
      )
      .sort((a, b) =>
        Number.isFinite(a.order) && Number.isFinite(b.order) && a.order !== b.order
          ? a.order - b.order
          : a.index - b.index,
      );
    if (rows.length) return rows.map((row) => row.text);
  }
  return strings(section?.bodyJson?.items);
}

/** The items of a list section: a checklist's items, else a set of steps. */
export function sectionItems(section: CourseSection | null | undefined): string[] {
  const items = strings(section?.bodyJson?.items);
  return items.length ? items : sectionSteps(section);
}

/** Whether a section has anything to print beyond its heading. */
export function sectionHasBody(section: CourseSection | null | undefined): boolean {
  return Boolean(
    section &&
      (sectionParagraphs(section).length ||
        sectionItems(section).length ||
        section.media?.url),
  );
}

/**
 * The sections a course guide draws, by what they are about. The keys are
 * the admin's (COURSE_SECTION_KEYS); `eligibility`, `apply` and
 * `admission-process` are what the guide used to look for and are still
 * read, after them, in case a record holds one.
 */
export function courseSections(sections: CourseSection[] | null | undefined) {
  const list = sections ?? [];
  /* A section is drawn for what it says: a heading over nothing is left
     out, as the guide leaves out any band with nothing in it. The call to
     action is the exception -- its heading is the invitation. */
  const named = (keys: string[], headingIsEnough = false) => {
    for (const key of keys) {
      const found = list.find((section) => section.sectionKey === key);
      if (found && (sectionHasBody(found) || (headingIsEnough && found.heading?.trim())))
        return found;
    }
    return null;
  };
  return {
    curriculum: named(['curriculum']),
    skills: named(['skills']),
    admission: named(['admission-requirements', 'eligibility']),
    documents: named(['documents']),
    careers: named(['career-outcomes']),
    application: named(['application-process', 'apply', 'admission-process']),
    sources: named(['source-trust']),
    counselling: named(['counselling-cta'], true),
  };
}
export type CourseSections = ReturnType<typeof courseSections>;

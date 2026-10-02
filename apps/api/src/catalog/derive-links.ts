import { Logger } from '@nestjs/common';
import { reconcileCountryCourses } from '../countries/country-course-reconciler';
import { reconcileCourseTuition } from '../countries/country-course-tuition';
import { reconcileCountryTaxonomy } from '../countries/country-taxonomy-reconciler';

/**
 * The one entry point a write path calls after changing anything the
 * catalogue's derived links are made of.
 *
 * Those links used to be worked out once per deployment, which meant the
 * catalogue told the truth on the day of a release and drifted for the
 * rest of the week. Worse, most of the editing is done by hand in the
 * admin, where no deployment is coming: an editor would add a university,
 * publish its offerings, and watch the destination page stay empty with
 * nothing to tell them why.
 *
 * So derivation happens on save. The deployment sweep stays, as the thing
 * that catches whatever a crash or a direct database edit left behind.
 *
 * The three steps are ordered, because each reads what the one before it
 * wrote: the offerings decide which destinations offer the course, those
 * mappings decide the destination's tuition, and the mappings decide which
 * subjects it teaches.
 */
const logger = new Logger('DeriveLinks');

export type DeriveClient = Parameters<typeof reconcileCountryCourses>[0];

/** Narrows a service's client to what the reconcilers need. */
export const asDeriveClient = (prisma: unknown) => prisma as DeriveClient;

export type CourseDerivation = {
  mappingsAdded: number;
  mappingsRevived: number;
  mappingsRemoved: number;
  countriesTouched: number;
  tuitionRewritten: number;
};

/**
 * Re-reads everything that follows from one course: which destinations
 * offer it, what they should quote for it, and which subjects they teach
 * because of it.
 */
export async function deriveForCourse(
  prisma: DeriveClient,
  courseId: string,
): Promise<CourseDerivation> {
  const mapping = await reconcileCountryCourses(prisma, courseId);
  const tuition = await reconcileCourseTuition(prisma, courseId);
  /* Both the destinations that gained the course and the ones that lost it
     have to be read again -- a subject should disappear with its last
     course as readily as it appears with the first. */
  for (const countryId of mapping.touched)
    await reconcileCountryTaxonomy(prisma, countryId);

  return {
    mappingsAdded: mapping.added,
    mappingsRevived: mapping.revived,
    mappingsRemoved: mapping.removed,
    countriesTouched: mapping.touched.length,
    tuitionRewritten: tuition.rewritten,
  };
}

/**
 * Re-reads every course one university teaches. Called when the
 * institution itself changes rather than a single offering, because its
 * country and its published state are what turn its offerings into a
 * destination's links.
 *
 * Offerings are read whatever state they are in: a course whose last live
 * offering was just withdrawn still needs its destinations worked out
 * again, and filtering to the live ones would hide exactly that case.
 */
export async function deriveForUniversity(
  prisma: DeriveClient,
  universityId: string,
): Promise<void> {
  const offerings = await prisma.universityCourseOffering.findMany({
    where: { universityId },
    select: { genericCourseId: true },
  });
  const courseIds = [...new Set(offerings.map((row) => row.genericCourseId))];
  for (const courseId of courseIds) await deriveForCourse(prisma, courseId);
}

/**
 * Runs a derivation without letting it fail the write that triggered it.
 *
 * An editor's save succeeded; refusing it because a sweep afterwards threw
 * would lose their work for a reason they cannot act on. The links are
 * left stale instead, which the deployment sweep repairs, and the failure
 * is logged loudly enough to be found before then.
 */
export async function deriveQuietly(
  what: string,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    logger.error(
      `Derived links were not updated after ${what}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

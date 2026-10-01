import type { PrismaClient } from '../generated/prisma/client';
import { PUBLISHED } from '../catalog/published';

/**
 * Works out which subjects and specializations a destination teaches, from
 * the courses actually mapped to it.
 *
 * These links used to be typed in and nothing checked them, so a country
 * could claim Engineering with no engineering course behind it and could
 * teach engineering courses without claiming the subject at all. The page
 * said one thing and the catalogue another.
 *
 * A country teaches a subject when a published course in that subject is
 * live against it. That is a fact about the catalogue, so it is worked out
 * rather than remembered, and it comes and goes with the courses.
 *
 * What an editor meant on purpose survives all of it. A new market usually
 * has its guide before it has its catalogue, and the one destination filled
 * in by hand must not be emptied by a sweep. Those rows are EDITORIAL and
 * this never touches them -- it adds and removes DERIVED rows only.
 */
export const DERIVED = 'DERIVED';
export const EDITORIAL = 'EDITORIAL';

export type TaxonomyChange = {
  subjectsAdded: number;
  subjectsRemoved: number;
  specializationsAdded: number;
  specializationsRemoved: number;
};

const EMPTY: TaxonomyChange = {
  subjectsAdded: 0,
  subjectsRemoved: 0,
  specializationsAdded: 0,
  specializationsRemoved: 0,
};

/** The live course mappings a destination's taxonomy is read from. */
function liveCourses(countryId: string) {
  return {
    countryId,
    status: 'ACTIVE',
    deletedAt: null,
    availabilityStatus: { in: ['AVAILABLE', 'LIMITED'] },
    course: PUBLISHED,
  };
}

export async function reconcileCountryTaxonomy(
  prisma: PrismaClient,
  countryId: string,
): Promise<TaxonomyChange> {
  const mappings = await prisma.countryCourse.findMany({
    where: liveCourses(countryId),
    select: { course: { select: { subjectId: true, subSubjectId: true } } },
  });

  const wantedSubjects = new Set<string>();
  const wantedSpecializations = new Set<string>();
  for (const row of mappings) {
    if (row.course?.subjectId) wantedSubjects.add(row.course.subjectId);
    if (row.course?.subSubjectId)
      wantedSpecializations.add(row.course.subSubjectId);
  }

  const [storedSubjects, storedSpecializations] = await Promise.all([
    prisma.countrySubject.findMany({
      where: { countryId },
      select: { id: true, subjectId: true, source: true },
    }),
    prisma.countrySubSubject.findMany({
      where: { countryId },
      select: { id: true, subSubjectId: true, source: true },
    }),
  ]);

  const change = { ...EMPTY };

  /* Already there, whatever put it there: an editor's row is proof enough
     that the link exists, so it is not duplicated as a derived one. */
  const haveSubject = new Set(storedSubjects.map((row) => row.subjectId));
  const addSubjects = [...wantedSubjects].filter((id) => !haveSubject.has(id));
  if (addSubjects.length) {
    await prisma.countrySubject.createMany({
      data: addSubjects.map((subjectId, index) => ({
        countryId,
        subjectId,
        source: DERIVED,
        displayOrder: storedSubjects.length + index,
      })),
    });
    change.subjectsAdded = addSubjects.length;
  }

  const staleSubjects = storedSubjects
    .filter(
      (row) => row.source === DERIVED && !wantedSubjects.has(row.subjectId),
    )
    .map((row) => row.id);
  if (staleSubjects.length) {
    await prisma.countrySubject.deleteMany({
      where: { id: { in: staleSubjects } },
    });
    change.subjectsRemoved = staleSubjects.length;
  }

  const haveSpecialization = new Set(
    storedSpecializations.map((row) => row.subSubjectId),
  );
  const addSpecializations = [...wantedSpecializations].filter(
    (id) => !haveSpecialization.has(id),
  );
  if (addSpecializations.length) {
    await prisma.countrySubSubject.createMany({
      data: addSpecializations.map((subSubjectId, index) => ({
        countryId,
        subSubjectId,
        source: DERIVED,
        displayOrder: storedSpecializations.length + index,
      })),
    });
    change.specializationsAdded = addSpecializations.length;
  }

  const staleSpecializations = storedSpecializations
    .filter(
      (row) =>
        row.source === DERIVED && !wantedSpecializations.has(row.subSubjectId),
    )
    .map((row) => row.id);
  if (staleSpecializations.length) {
    await prisma.countrySubSubject.deleteMany({
      where: { id: { in: staleSpecializations } },
    });
    change.specializationsRemoved = staleSpecializations.length;
  }

  return change;
}

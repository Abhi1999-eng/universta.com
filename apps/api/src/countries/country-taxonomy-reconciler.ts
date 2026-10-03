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
 * in by hand must not be emptied by a sweep. Those rows are EDITORIAL.
 *
 * Subjects and specializations part ways on what "survives" means, because
 * they start in different places. A destination is born listing every
 * subject (`attachDefaultTaxonomy`), so for a subject the row is nearly
 * always there already and the only thing left to work out is whether a
 * course stands behind it: the row is marked DERIVED while one does and
 * handed back as EDITORIAL when the last one goes. Nothing is deleted --
 * deleting would take a default link away for good the first time a
 * programme was published and then withdrawn. Specializations are never
 * attached by default, so theirs still come and go with the courses.
 */
export const DERIVED = 'DERIVED';
export const EDITORIAL = 'EDITORIAL';

export type TaxonomyChange = {
  /** Subjects that gained a course behind them: written new, or an
   * existing link marked DERIVED. */
  subjectsAdded: number;
  /** Subjects whose last course went: the link stays, as EDITORIAL. */
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

  /* No row at all -- an editor unticked it, or the destination predates the
     default links. The course is a fact either way, so the link is written. */
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
  }

  /* The usual case now: the link has stood since the destination was born,
     as EDITORIAL, and a course has arrived under it. Leaving it EDITORIAL
     is what this used to do, and it meant the page went on saying "no
     programme in the catalogue yet" about a field with programmes in it --
     for every subject of every destination, once they all start listed. */
  const nowTaught = storedSubjects
    .filter(
      (row) => row.source !== DERIVED && wantedSubjects.has(row.subjectId),
    )
    .map((row) => row.id);
  if (nowTaught.length) {
    await prisma.countrySubject.updateMany({
      where: { id: { in: nowTaught } },
      data: { source: DERIVED },
    });
  }
  change.subjectsAdded = addSubjects.length + nowTaught.length;

  /* And back again when the last course goes. Handed to the editor rather
     than deleted: the destination still lists the field, it just no longer
     has anything to show for it, and from here the editor can untick it. */
  const noLongerTaught = storedSubjects
    .filter(
      (row) => row.source === DERIVED && !wantedSubjects.has(row.subjectId),
    )
    .map((row) => row.id);
  if (noLongerTaught.length) {
    await prisma.countrySubject.updateMany({
      where: { id: { in: noLongerTaught } },
      data: { source: EDITORIAL },
    });
    change.subjectsRemoved = noLongerTaught.length;
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

/** The two tables this writes, narrowed to what it uses. */
type AttachClient = {
  country: { findMany: (args: unknown) => Promise<Array<{ id: string }>> };
  subject: { findMany: (args: unknown) => Promise<Array<{ id: string }>> };
  countrySubject: {
    createMany: (args: {
      data: Array<{ countryId: string; subjectId: string; source: string }>;
      skipDuplicates?: boolean;
    }) => Promise<{ count: number }>;
  };
};

/**
 * The links a destination or a field starts life with.
 *
 * Every subject Universta publishes is taught somewhere, and a destination
 * nobody has narrowed yet offers all of them -- which is what the taxonomy
 * SQL has always seeded, and what the country editor exists to cut down.
 * A destination or a subject born afterwards had none of it, so a new
 * country opened on an empty field list and a new subject reached no
 * destination until somebody attached it by hand, thirty times or two
 * hundred and five.
 *
 * Written EDITORIAL, which is the value the editor can then remove:
 * `CountriesService.update` replaces exactly the EDITORIAL slice, so a
 * narrowing sticks. The sweep above marks a row DERIVED while a course
 * stands behind it and hands it back when the last one goes.
 *
 * `skipDuplicates` rather than a read-then-write, because the caller may
 * already have written the pairs its own payload asked for, and the unique
 * key would otherwise fail the transaction that created the record.
 *
 * Specializations are deliberately not written. Attaching every one of them
 * is 190,035 rows for two readers, and the pages that show a destination's
 * specializations read them from the subject rather than from here.
 */
export async function attachDefaultTaxonomy(
  client: AttachClient,
  target: { countryId: string } | { subjectId: string },
): Promise<number> {
  /* Not filtered to PUBLISHED, and not to live records either. A draft
     publishes later and an archived record can be restored, and a link made
     now is the only way either reaches what already existed -- filtering
     here would mean a subject published tomorrow never reached a country
     created today, and a country restored next week came back missing every
     subject created while it was away. Nothing leaks: every reader filters
     the record's own status and `deletedAt`, so the link is invisible until
     the moment it should appear. */
  const everything = { select: { id: true } };
  if ('countryId' in target) {
    const subjects = await client.subject.findMany(everything);
    if (!subjects.length) return 0;
    const { count } = await client.countrySubject.createMany({
      /* No order of its own. These arrive in id order, which means
         nothing, and numbering them would freeze that as the destination's
         arrangement; left equal, the catalogue's order shows through. */
      data: subjects.map((subject) => ({
        countryId: target.countryId,
        subjectId: subject.id,
        source: EDITORIAL,
      })),
      skipDuplicates: true,
    });
    return count;
  }
  const countries = await client.country.findMany(everything);
  if (!countries.length) return 0;
  const { count } = await client.countrySubject.createMany({
    data: countries.map((country) => ({
      countryId: country.id,
      subjectId: target.subjectId,
      source: EDITORIAL,
    })),
    skipDuplicates: true,
  });
  return count;
}

import type { PrismaClient } from '../generated/prisma/client';
import { PUBLISHED } from '../catalog/published';
import { DERIVED } from './country-taxonomy-reconciler';

/**
 * Works out which destinations offer a course, from the universities that
 * actually teach it.
 *
 * This is the link the chain was missing. A destination's subjects are
 * worked out from its course mappings, and its indicative tuition from the
 * offerings behind them -- but nothing ever created the mapping itself.
 * Every row was typed in, by the country sheet or by hand, against
 * offerings nobody checked it against. Three of 4,695 mappings had a
 * priced offering behind them, and the two layers were effectively
 * strangers.
 *
 * A country offers a course when one of its published universities has a
 * published offering for it. Nothing else can make that true, so the
 * mapping is worked out rather than remembered.
 *
 * What an editor meant on purpose survives all of it. A new market has its
 * guide long before it has its catalogue, and a destination filled in by
 * hand must not be emptied by a sweep. Those rows are EDITORIAL and this
 * never touches them.
 *
 * A row that falls out is set aside rather than destroyed. The mapping
 * carries country-level editorial work of its own -- intake months, visa
 * notes, admission requirements -- and an offering that lapses for a term
 * should not cost an editor all of it. When the offering returns, so does
 * the row, with that work intact.
 */
export type CountryCourseChange = {
  added: number;
  revived: number;
  removed: number;
  /** Every destination this call could have changed, before and after. */
  touched: string[];
};

/** The live offerings a course's destinations are read from. */
export function liveOfferingsForCourse(courseId: string) {
  return {
    genericCourseId: courseId,
    ...PUBLISHED,
    university: { ...PUBLISHED },
  };
}

export async function reconcileCountryCourses(
  prisma: PrismaClient,
  courseId: string,
): Promise<CountryCourseChange> {
  const offerings = await prisma.universityCourseOffering.findMany({
    where: liveOfferingsForCourse(courseId),
    select: { university: { select: { countryId: true } } },
  });
  const wanted = new Set(
    offerings
      .map((row) => row.university?.countryId)
      .filter((id): id is string => Boolean(id)),
  );

  /* Soft-deleted rows are read too: the mapping is unique per country and
     course, so one left behind by an earlier sweep has to be revived
     rather than created a second time. */
  const stored = await prisma.countryCourse.findMany({
    where: { courseId },
    select: { id: true, countryId: true, source: true, deletedAt: true },
  });
  const byCountry = new Map(stored.map((row) => [row.countryId, row]));

  const change: CountryCourseChange = {
    added: 0,
    revived: 0,
    removed: 0,
    touched: [],
  };

  const create: string[] = [];
  const revive: string[] = [];
  for (const countryId of wanted) {
    const row = byCountry.get(countryId);
    if (!row) {
      create.push(countryId);
      continue;
    }
    /* Already there, whatever put it there: an editor's row is proof
       enough that the link exists, so it is not duplicated.

       Set aside, though, it has to come back, because a published
       university is teaching the course here and that is not a matter of
       opinion. It returns as DERIVED whatever it was before: an editor
       who removed their own row meant to withdraw their claim, and this
       is not that claim coming back -- it is the catalogue stating a fact
       the editor no longer has to own, and it will leave again on its own
       when the last offering does. */
    if (row.deletedAt) revive.push(row.id);
  }

  if (create.length) {
    await prisma.countryCourse.createMany({
      data: create.map((countryId) => ({
        countryId,
        courseId,
        source: DERIVED,
        /* The figures are the tuition reconciler's job, and it runs next.
           Leaving them unset says "not known yet" rather than naming a
           price nobody charges. */
        tuitionIsOverride: false,
      })),
    });
    change.added = create.length;
  }

  if (revive.length) {
    await prisma.countryCourse.updateMany({
      where: { id: { in: revive } },
      data: { deletedAt: null, status: 'ACTIVE', source: DERIVED },
    });
    change.revived = revive.length;
  }

  const stale = stored
    .filter(
      (row) =>
        row.source === DERIVED && !row.deletedAt && !wanted.has(row.countryId),
    )
    .map((row) => row.id);
  if (stale.length) {
    await prisma.countryCourse.updateMany({
      where: { id: { in: stale } },
      data: { deletedAt: new Date() },
    });
    change.removed = stale.length;
  }

  /* Both sides matter to the caller: a destination that just gained the
     course and one that just lost it each need their taxonomy read again. */
  change.touched = [
    ...new Set([...wanted, ...stored.map((row) => row.countryId)]),
  ];
  return change;
}

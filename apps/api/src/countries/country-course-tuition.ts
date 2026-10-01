import type { PrismaClient } from '../generated/prisma/client';
import { PUBLISHED } from '../catalog/published';

/**
 * Works a destination's indicative tuition for a course out from what its
 * universities actually charge.
 *
 * The same fact was recorded twice and the two were never introduced. A
 * country mapping carries a range for "this course, in this country"; an
 * offering carries what a named institution in that country charges for it.
 * Nothing reconciled them, so a destination could quote a figure no
 * university behind it charges, and nobody would notice.
 *
 * The offerings are the reality -- a real institution, a real programme, a
 * real price -- so the country-level range is a summary of them: lowest
 * minimum and highest maximum across the live ones.
 *
 * An editor still has the last word. A row they set by hand is an override
 * and this leaves it alone, because a figure somebody sourced should never
 * be quietly replaced by an arithmetic one.
 *
 * Currency is the one thing it will not guess. A range spanning two
 * currencies is not a range, so when a country's offerings disagree the
 * derivation stands down and leaves whatever was there -- which is the
 * honest answer until somebody decides what the country's figure means.
 */
export type DerivedTuition = {
  min: string | null;
  max: string | null;
  currencyCode: string | null;
  /** How many live offerings the figures came from. */
  offerings: number;
};

type OfferingRow = {
  tuitionMin: unknown;
  tuitionMax: unknown;
  currencyCode: string | null;
};

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The figures a set of offerings adds up to. */
export function summariseOfferings(rows: OfferingRow[]): DerivedTuition {
  const priced = rows.filter(
    (row) =>
      asNumber(row.tuitionMin) !== null || asNumber(row.tuitionMax) !== null,
  );
  if (!priced.length)
    return { min: null, max: null, currencyCode: null, offerings: 0 };

  const currencies = new Set(
    priced.map((row) => row.currencyCode).filter(Boolean) as string[],
  );
  /* Two currencies cannot make one range, and converting them would be
     inventing a rate. */
  if (currencies.size > 1)
    return {
      min: null,
      max: null,
      currencyCode: null,
      offerings: priced.length,
    };

  const mins = priced
    .map((row) => asNumber(row.tuitionMin) ?? asNumber(row.tuitionMax))
    .filter((value): value is number => value !== null);
  const maxes = priced
    .map((row) => asNumber(row.tuitionMax) ?? asNumber(row.tuitionMin))
    .filter((value): value is number => value !== null);

  return {
    min: mins.length ? String(Math.min(...mins)) : null,
    max: maxes.length ? String(Math.max(...maxes)) : null,
    currencyCode: [...currencies][0] ?? null,
    offerings: priced.length,
  };
}

/** The live offerings a country's figure for a course is read from. */
export function liveOfferingsWhere(countryId: string, courseId: string) {
  return {
    genericCourseId: courseId,
    deletedAt: null,
    status: 'PUBLISHED',
    university: { ...PUBLISHED, countryId },
  };
}

export type TuitionSweep = { checked: number; rewritten: number };

/**
 * Rewrites every derived country-course figure for one course, across every
 * destination it is mapped to. Called when an offering changes, because
 * that is the only thing the figures are made of.
 */
export async function reconcileCourseTuition(
  prisma: PrismaClient,
  courseId: string,
): Promise<TuitionSweep> {
  const mappings = await prisma.countryCourse.findMany({
    where: { courseId, deletedAt: null, tuitionIsOverride: false },
    select: {
      id: true,
      countryId: true,
      indicativeTuitionMin: true,
      indicativeTuitionMax: true,
      currencyCode: true,
    },
  });

  let rewritten = 0;
  for (const mapping of mappings) {
    const offerings = await prisma.universityCourseOffering.findMany({
      where: liveOfferingsWhere(mapping.countryId, courseId),
      select: { tuitionMin: true, tuitionMax: true, currencyCode: true },
    });
    const derived = summariseOfferings(offerings);
    /* Nothing priced behind it: leave the row as it is rather than wiping a
       figure in favour of silence. */
    if (!derived.offerings) continue;

    const same =
      String(mapping.indicativeTuitionMin ?? '') ===
        String(derived.min ?? '') &&
      String(mapping.indicativeTuitionMax ?? '') ===
        String(derived.max ?? '') &&
      (mapping.currencyCode ?? null) === derived.currencyCode;
    if (same) continue;

    await prisma.countryCourse.update({
      where: { id: mapping.id },
      data: {
        indicativeTuitionMin: derived.min,
        indicativeTuitionMax: derived.max,
        ...(derived.currencyCode ? { currencyCode: derived.currencyCode } : {}),
      },
    });
    rewritten += 1;
  }

  return { checked: mappings.length, rewritten };
}

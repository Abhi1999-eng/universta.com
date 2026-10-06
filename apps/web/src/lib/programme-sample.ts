import { phaseProgrammes } from './phase1';
import {
  courseApiParams,
  courseRunParams,
  readCourseFilters,
  toProgrammeList,
  type CourseFilters,
  type CourseScope,
  type OfferingCardData,
  type ProgrammeList,
} from './university-courses';

/**
 * The programmes of part of the catalogue as a results block draws them:
 * the filters the address asks for, every page of eighteen up to the one
 * it names, the counts beside each filter and the headline figures, all
 * taken over that part. Null when the read fails, so the page can leave
 * the block out and keep the rest of itself.
 */
export async function programmeList(
  filters: CourseFilters,
  scope: CourseScope,
): Promise<ProgrammeList | null> {
  try {
    return toProgrammeList(
      await phaseProgrammes(courseRunParams(filters, scope)),
      filters,
    );
  } catch {
    return null;
  }
}

/**
 * The first few programmes of part of the catalogue -- one course, one
 * subject or one specialization, in a destination or everywhere -- and how
 * many there are, for a page that shows a handful and links to the rest.
 *
 * The part is sent as a scope, so the API counts its universities and
 * cities over that part alone, and the count is the total of the very query
 * the "View all" link opens in the finder. Null when the read fails: the
 * section that would show them stands down, and the page does not.
 */
export type ProgrammeSample = {
  cards: OfferingCardData[];
  /** Every programme in the part, not only the ones read. */
  total: number;
  universities: number;
  cities: number;
};

export async function programmeSample(
  scope: CourseScope,
  limit = 6,
): Promise<ProgrammeSample | null> {
  const filters = readCourseFilters({});
  try {
    const raw = await phaseProgrammes({
      ...courseApiParams(filters, 1, scope),
      limit: String(limit),
    });
    const list = toProgrammeList(raw, filters);
    return {
      cards: list.cards.slice(0, limit),
      total: list.meta.total,
      universities: list.summary.universities,
      cities: list.summary.cities,
    };
  } catch {
    return null;
  }
}

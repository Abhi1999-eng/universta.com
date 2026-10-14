import type { AnyRecord } from '@/components/phase1/PhaseOneViews';
import { getCourseLevels } from '@/lib/catalog';
import { phaseListAll } from '@/lib/phase1';
import { toCountryScholarshipRows } from './country-scholarship-list';

/** How many level reads are in flight together: the API sheds load above
 *  about a dozen concurrent requests, and a page has others of its own. */
const LEVEL_BATCH = 3;

/**
 * Every published scholarship a list narrows in the browser, read once on
 * the server: all of them for the worldwide finder, a destination's or a
 * subject's for a page that asks for those.
 *
 * Which awards are for which study level is asked of the list endpoint one
 * level at a time -- its own reading of "for Master's", through the
 * programmes an award is attached to -- so the level filter agrees wherever
 * it is offered. A level whose read fails is not offered, rather than
 * offered with a count that is not true.
 */
export async function loadScholarshipRows(params: Record<string, string> = {}) {
  const [list, levels] = await Promise.all([
    phaseListAll<AnyRecord>('scholarships', params).catch(() => null),
    getCourseLevels().catch(() => []),
  ]);
  const byLevel = new Map<string, Set<string>>();
  if (list?.data.length) {
    for (let index = 0; index < levels.length; index += LEVEL_BATCH) {
      const batch = levels.slice(index, index + LEVEL_BATCH);
      const results = await Promise.all(
        batch.map((level) =>
          phaseListAll<AnyRecord>('scholarships', { ...params, degreeLevel: level.code })
            .then((result) => result.data)
            .catch(() => []),
        ),
      );
      batch.forEach((level, at) => {
        const ids = new Set(results[at]!.map((row) => String(row.id)));
        if (ids.size) byLevel.set(level.code, ids);
      });
    }
  }
  return {
    failed: list === null,
    rows: toCountryScholarshipRows(list?.data ?? [], byLevel, new Date()),
    levels: levels.map((level) => ({ code: level.code, name: level.name })),
  };
}

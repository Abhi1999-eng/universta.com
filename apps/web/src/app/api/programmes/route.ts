import { NextResponse } from 'next/server';
import { phaseProgrammes } from '@/lib/phase1';
import {
  COURSE_FILTER_GROUPS,
  courseApiParams,
  readCourseFilters,
  toOfferingCards,
  type CourseFilterKey,
  type CourseScope,
} from '@/lib/university-courses';

/**
 * The next page of programmes across universities, for "Load more courses"
 * on the course finder and on the lists drawn from it.
 *
 * The reference's button fetches its next batch from a JSON endpoint and
 * appends it. The browser cannot reach the catalogue API directly, so this
 * asks it on the browser's behalf -- with the same filters, read by the
 * same function the page uses -- and answers with cards already shaped the
 * way the page draws them, each linking to its programme under its
 * university's country. A list fixed to part of the catalogue names that
 * part in `within`, which is passed on so the API reads the same part.
 * A university's own list keeps its own route, /api/university-courses.
 */
const KEYS = new Set<string>(COURSE_FILTER_GROUPS.map((group) => group.key));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = readCourseFilters(params);
  const scope: CourseScope = {};
  for (const key of (params.get('within') ?? '').split(','))
    if (KEYS.has(key)) {
      const name = key as CourseFilterKey;
      scope[name] = filters[name];
    }
  try {
    const result = await phaseProgrammes<Record<string, unknown>>(
      courseApiParams(filters, filters.page, scope),
    );
    return NextResponse.json(
      { cards: toOfferingCards(result.data), meta: result.meta },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Courses could not be loaded' },
      { status: 502 },
    );
  }
}

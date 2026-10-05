import { NextResponse } from 'next/server';
import { phaseUniversityCourses } from '@/lib/phase1';
import {
  courseApiParams,
  firstCity,
  readCourseFilters,
  toCountry,
  toOfferingCards,
} from '@/lib/university-courses';

/**
 * The next page of a university's course list, for "Load more courses".
 *
 * The reference's button fetches its next page from a JSON endpoint and
 * appends it. The browser cannot reach the catalogue API directly, so this
 * asks it on the browser's behalf -- with the same filters, read by the same
 * function the page uses -- and answers with cards already shaped the way
 * the page draws them.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const university = params.get('university') ?? '';
  if (!SLUG.test(university))
    return NextResponse.json({ error: 'Unknown university' }, { status: 400 });
  const filters = readCourseFilters(params);
  try {
    const result = await phaseUniversityCourses<Record<string, unknown>>(
      university,
      undefined,
      courseApiParams(filters),
    );
    const owner = result.university as Record<string, unknown> | undefined;
    const country = toCountry(owner?.country);
    if (!owner || !country)
      return NextResponse.json({ error: 'Unknown university' }, { status: 404 });
    return NextResponse.json(
      {
        cards: toOfferingCards(result.data, {
          name: String(owner.name),
          slug: String(owner.slug),
          country,
          city: firstCity(owner),
        }),
        meta: result.meta,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Courses could not be loaded' },
      { status: 502 },
    );
  }
}

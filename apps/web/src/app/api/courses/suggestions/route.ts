import { NextResponse } from 'next/server';
import { phaseProgrammeSuggestions } from '@/lib/phase1';

/**
 * Suggestions for what has been typed into a course search.
 *
 * By default these are course names, exactly as the course API answers
 * them; the older listings read that shape. Asked `with=programmes` -- the
 * course finder's guides view -- the answer also carries the programmes
 * and universities the programmes API suggests, each with the page it
 * opens: a university's programmes or the programme itself, which a
 * search over course names could never reach. A few course names come
 * first, because those are what that search matches; a name is offered
 * once.
 */

type Row = Record<string, unknown>;

const COURSE_NAMES_FIRST = 4;
const MOST = 8;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ data: [], meta: null, error: null });
  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  const courses = fetch(
    new URL(`/api/v1/courses/suggestions?q=${encodeURIComponent(query)}`, base),
    { cache: 'no-store' },
  );
  if (params.get('with') !== 'programmes') {
    const response = await courses;
    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { 'cache-control': 'no-store' },
    });
  }

  /* Either half failing leaves the other to answer. */
  const [names, programmes] = await Promise.all([
    courses
      .then(async (response) =>
        response.ok ? (((await response.json()) as { data?: Row[] }).data ?? []) : [],
      )
      .catch(() => [] as Row[]),
    phaseProgrammeSuggestions(query).catch(() => []),
  ]);
  const seen = new Set<string>();
  const once = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const courseItems = names.filter((row) => once(String(row.name ?? '')));
  const programmeItems = programmes
    .filter((item) => once(item.label))
    .map((item) => ({ id: item.href, name: item.label, kind: item.kind, href: item.href }));
  const data = [
    ...courseItems.slice(0, COURSE_NAMES_FIRST),
    ...programmeItems,
    ...courseItems.slice(COURSE_NAMES_FIRST),
  ].slice(0, MOST);
  return NextResponse.json(
    { data, meta: null, error: null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

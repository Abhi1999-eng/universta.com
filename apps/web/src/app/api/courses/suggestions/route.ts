import { NextResponse } from 'next/server';
import { getCourses } from '@/lib/catalog';
import { phaseProgrammes, phaseProgrammeSuggestions, type ProgrammeSuggestion } from '@/lib/phase1';
import { subjectLevelHref } from '@/lib/subject-levels';
import { toOfferingCards } from '@/lib/university-courses';

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

function combined(names: Row[], programmes: ProgrammeSuggestion[]) {
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
  return [
    ...courseItems.slice(0, COURSE_NAMES_FIRST),
    ...programmeItems,
    ...courseItems.slice(COURSE_NAMES_FIRST),
  ].slice(0, MOST);
}

/** A scoped listing searches its own catalogue, including for suggestions.
 * Reading the global suggestions endpoint and filtering its first eight rows
 * afterwards would hide valid matches outside that first global page. */
async function scopedSuggestions(params: URLSearchParams, query: string, scope: Record<string, string>) {
  const names = getCourses({ ...scope, q: query, pageSize: String(MOST) })
    .then((result) => result.data as unknown as Row[])
    .catch(() => [] as Row[]);
  if (params.get('with') !== 'programmes') return names;

  const programmeScope = Object.fromEntries(Object.entries(scope).map(([key, value]) => [
    key === 'subSubject' ? 'specialization' : key, value,
  ]));
  const [courses, answer] = await Promise.all([
    names,
    phaseProgrammes<{ data?: unknown[] }>({
      ...programmeScope, q: query, limit: String(MOST),
      within: Object.keys(programmeScope).join(','),
    }).catch(() => ({ data: [] })),
  ]);
  const cards = toOfferingCards(answer.data);
  const subject = scope.subject?.split(',');
  const specialization = scope.subSubject?.split(',');
  const level = scope.level?.split(',');
  const base = subject?.length === 1 && level?.length === 1 && (!specialization || specialization.length === 1)
    ? subjectLevelHref({ subject: subject[0], specialization: specialization?.[0], level: level[0] })
    : '/courses';
  const programmes: ProgrammeSuggestion[] = cards.flatMap((card) => [
    ...(card.university.name.toLowerCase().includes(query.toLowerCase()) ? [{
      label: card.university.name,
      kind: 'university' as const,
      href: `${base}?${new URLSearchParams({ university: card.university.slug })}`,
    }] : []),
    { label: `${card.name} · ${card.university.name}`, kind: 'programme' as const, href: card.href },
  ]);
  return combined(courses, programmes);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ data: [], meta: null, error: null });
  const scope: Record<string, string> = {};
  for (const key of ['subject', 'subSubject', 'level']) {
    const value = params.get(key) ?? (key === 'subSubject' ? params.get('specialization') : null);
    const values = [...new Set((value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean))];
    if (values.length) scope[key] = values.join(',');
  }
  if (Object.keys(scope).length) {
    return NextResponse.json(
      { data: await scopedSuggestions(params, query, scope), meta: null, error: null },
      { headers: { 'cache-control': 'no-store' } },
    );
  }
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
  return NextResponse.json(
    { data: combined(names, programmes), meta: null, error: null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

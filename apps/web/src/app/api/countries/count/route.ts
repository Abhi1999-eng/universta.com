import { NextRequest, NextResponse } from 'next/server';

/** The filter drawer stages its choices, so "Show N destinations" has to count
 * the set the visitor is about to see rather than the one already on screen.
 * Same-origin, and only ever forwards the listing's own filter vocabulary — a
 * hostile query string cannot reach the API with anything else. */
const FORWARDED = new Set([
  'q',
  'continent',
  'subjects',
  'intakes',
  'ieltsMax',
  'ieltsOptional',
  'postStudyWork',
  'postStudyWorkMonthsMin',
  'partTimeWork',
  'workHoursMin',
  'applicationFee',
  'universitiesMin',
  'currency',
  'tuitionMax',
  'livingMax',
  'budgetBand',
]);

export async function GET(request: NextRequest) {
  const forwarded = new URLSearchParams();
  for (const [key, value] of request.nextUrl.searchParams.entries())
    if (FORWARDED.has(key) && value) forwarded.set(key, value);
  forwarded.set('limit', '1');

  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  try {
    const upstream = await fetch(
      `${base}/api/v1/countries?${forwarded.toString()}`,
      { cache: 'no-store' },
    );
    const body = (await upstream.json()) as { meta?: { total?: number } };
    if (!upstream.ok)
      return NextResponse.json({ total: null }, { status: upstream.status });
    return NextResponse.json({ total: body.meta?.total ?? 0 });
  } catch {
    return NextResponse.json({ total: null }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * The browser's way to the catalogue search.
 *
 * The API's address is a server secret here -- every other lib reads
 * `API_BASE_URL` on the server and renders the result -- so a box that
 * answers while somebody types needs a route of its own to ask through.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = request.nextUrl.searchParams.get('limit')?.trim();
  if (!q) return NextResponse.json({ data: { query: '', total: 0, groups: [] } });
  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  const url = new URL('/api/v1/phase1/search', base);
  url.searchParams.set('q', q);
  if (limit) url.searchParams.set('limit', limit);
  try {
    const upstream = await fetch(url, { cache: 'no-store' });
    return NextResponse.json(await upstream.json(), { status: upstream.status });
  } catch {
    /* The box keeps working as a plain form when this fails. */
    return NextResponse.json(
      { data: { query: q, total: 0, groups: [] }, error: { message: 'Search unavailable' } },
      { status: 502 },
    );
  }
}

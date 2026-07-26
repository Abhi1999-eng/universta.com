import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    return NextResponse.json(
      { data: [], meta: null, error: null },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';
  const target = new URL('/api/v1/subjects', base);
  target.searchParams.set('q', query);
  target.searchParams.set('limit', '8');
  const response = await fetch(target, { cache: 'no-store' });
  return NextResponse.json(await response.json(), {
    status: response.status,
    headers: { 'cache-control': 'no-store' },
  });
}

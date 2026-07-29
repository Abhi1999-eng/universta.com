import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = 'universta_ab';

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 2 * 1024) return NextResponse.json({ data: null, error: { code: 'REQUEST_TOO_LARGE', message: 'Request is too large' } }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid conversion payload' } }, { status: 400 }); }
  const origin = request.headers.get('origin');
  if (origin && origin !== (process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000')) return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Request origin is not allowed' } }, { status: 403 });
  const anonymousId = request.cookies.get(COOKIE_NAME)?.value;
  try {
    const upstream = await fetch(new URL('/api/v1/phase1/experiments/conversions', process.env.API_BASE_URL ?? 'http://127.0.0.1:4000'), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(anonymousId ? { 'x-anon-id': anonymousId } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    return NextResponse.json(await upstream.json(), { status: upstream.status, headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ data: null, error: { code: 'CONVERSIONS_UNAVAILABLE', message: 'Conversion tracking is temporarily unavailable' } }, { status: 502 }); }
}

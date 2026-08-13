import { NextResponse } from 'next/server';

/**
 * One proxy for the whole student API.
 *
 * The browser never talks to the API host directly: keeping it same-origin is
 * what lets the refresh token stay an HttpOnly cookie the page cannot read.
 * This handler forwards the request, passes the caller's Authorization header
 * through, and relays any Set-Cookie the API returns so rotation still works.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

async function forward(
  request: Request,
  path: string[],
  method: string,
): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`/api/v1/student/${path.join('/')}`, API_BASE);
  target.search = incoming.search;

  const headers = new Headers();
  const auth = request.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const contentType = request.headers.get('content-type');
  // Multipart uploads must keep their generated boundary, so the body is
  // streamed through untouched rather than parsed and rebuilt.
  if (contentType) headers.set('content-type', contentType);

  const body =
    method === 'GET' || method === 'DELETE'
      ? undefined
      : await request.arrayBuffer();

  const response = await fetch(target, {
    method,
    headers,
    body: body && body.byteLength ? body : undefined,
    cache: 'no-store',
    redirect: 'manual',
  });

  const payload = await response.arrayBuffer();
  const out = new NextResponse(payload.byteLength ? payload : null, {
    status: response.status,
  });
  const type = response.headers.get('content-type');
  if (type) out.headers.set('content-type', type);
  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === 'set-cookie') out.headers.append('set-cookie', value);
  }
  out.headers.set('cache-control', 'no-store');
  return out;
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'GET');
}
export async function POST(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'POST');
}
export async function PATCH(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'PATCH');
}
export async function PUT(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'PUT');
}
export async function DELETE(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'DELETE');
}

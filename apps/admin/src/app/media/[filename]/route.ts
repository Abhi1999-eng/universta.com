import type { NextRequest } from 'next/server';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

type Context = { params: Promise<{ filename: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { filename } = await context.params;
  const upstream = await fetch(
    new URL(`/api/v1/media/${encodeURIComponent(filename)}`, apiBaseUrl),
    { cache: 'force-cache' },
  );

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  const cacheControl = upstream.headers.get('cache-control');
  const contentLength = upstream.headers.get('content-length');
  if (contentType) headers.set('content-type', contentType);
  if (cacheControl) headers.set('cache-control', cacheControl);
  if (contentLength) headers.set('content-length', contentLength);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

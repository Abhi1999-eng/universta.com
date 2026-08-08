import type { NextRequest } from 'next/server';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

type Context = { params: Promise<{ filename: string }> };

/**
 * MediaAsset.publicUrl is intentionally stored as /media/<filename> so it is
 * portable between environments. The binary itself is served by the API.
 * Proxy it through the public Next.js origin so browser-resolved relative
 * media URLs work in production without exposing an environment-specific API
 * hostname in persisted content.
 */
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

import type { NextRequest } from 'next/server';
import { proxyCatalogRoute, type CatalogProxyOperation } from '@/lib/server/catalog-proxy';

type Context = { params: Promise<{ id: string; profile: string }> };
const allowed = new Set(['cost', 'work', 'language', 'intakes', 'statistics']);
function operation(action: 'get' | 'put' | 'delete', id: string, profile: string): CatalogProxyOperation { return `country-profiles:${action}:${id}:${profile}` as CatalogProxyOperation; }
async function route(request: NextRequest, context: Context, action: 'get' | 'put' | 'delete') {
  const params = await context.params;
  if (!allowed.has(params.profile) || (action === 'delete' && params.profile === 'intakes')) return new Response('Not found', { status: 404 });
  return proxyCatalogRoute(request, operation(action, params.id, params.profile));
}
export function GET(request: NextRequest, context: Context) { return route(request, context, 'get'); }
export function PUT(request: NextRequest, context: Context) { return route(request, context, 'put'); }
export function DELETE(request: NextRequest, context: Context) { return route(request, context, 'delete'); }

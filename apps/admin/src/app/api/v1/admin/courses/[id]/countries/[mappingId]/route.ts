import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; mappingId: string }> };
export async function PATCH(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `courses:countries:update:${p.id}:${p.mappingId}`); }
export async function DELETE(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `courses:countries:delete:${p.id}:${p.mappingId}`); }

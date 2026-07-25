import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; subId: string }> };
export async function GET(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subsubjects:get:${p.id}:${p.subId}`); }
export async function PATCH(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subsubjects:update:${p.id}:${p.subId}`); }
export async function DELETE(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subsubjects:delete:${p.id}:${p.subId}`); }

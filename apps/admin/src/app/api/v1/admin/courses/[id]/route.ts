import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:get:${(await context.params).id}`); }
export async function PATCH(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:update:${(await context.params).id}`); }
export async function DELETE(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:delete:${(await context.params).id}`); }

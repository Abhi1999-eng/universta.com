import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `subjects:get:${(await context.params).id}`); }
export async function PATCH(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `subjects:update:${(await context.params).id}`); }
export async function DELETE(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `subjects:delete:${(await context.params).id}`); }

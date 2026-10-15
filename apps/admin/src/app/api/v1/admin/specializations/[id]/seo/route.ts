import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `specializations-seo:get:${(await context.params).id}`); }
export async function PUT(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `specializations-seo:put:${(await context.params).id}`); }
export async function DELETE(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `specializations-seo:delete:${(await context.params).id}`); }

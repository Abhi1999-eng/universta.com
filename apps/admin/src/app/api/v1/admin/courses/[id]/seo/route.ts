import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses-seo:get:${(await context.params).id}`); }
export async function PUT(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses-seo:put:${(await context.params).id}`); }
export async function DELETE(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses-seo:delete:${(await context.params).id}`); }

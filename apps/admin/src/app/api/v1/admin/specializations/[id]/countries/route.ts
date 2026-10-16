import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `specializations:countries:get:${(await context.params).id}`); }
export async function PUT(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `specializations:countries:put:${(await context.params).id}`); }

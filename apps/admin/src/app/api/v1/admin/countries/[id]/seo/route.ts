import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `editorial:GET:${(await context.params).id}:seo`); }
export async function PUT(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `editorial:PUT:${(await context.params).id}:seo`); }
export async function DELETE(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `editorial:DELETE:${(await context.params).id}:seo`); }

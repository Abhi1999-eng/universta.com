import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:modes:${(await context.params).id}`); }

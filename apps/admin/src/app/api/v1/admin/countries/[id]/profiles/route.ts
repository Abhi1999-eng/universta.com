import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `country-profiles:all:${(await context.params).id}`); }

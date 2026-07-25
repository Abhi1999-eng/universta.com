import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:countries:list:${(await context.params).id}`); }
export async function POST(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `courses:countries:create:${(await context.params).id}`); }

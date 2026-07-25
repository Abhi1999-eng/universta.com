import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `editorial:GET:${(await context.params).id}:sections`); }
export async function POST(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `editorial:POST:${(await context.params).id}:sections`); }

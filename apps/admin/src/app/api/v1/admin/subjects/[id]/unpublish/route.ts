import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) { return proxyCatalogRoute(request, `subjects:unpublish:${(await context.params).id}`); }

import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; subId: string }> };
export async function POST(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subsubjects:publish:${p.id}:${p.subId}`); }

import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; mappingId: string }> };
export async function GET(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `courses:intakes:list:${p.id}:${p.mappingId}`); }
export async function PUT(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `courses:intakes:put:${p.id}:${p.mappingId}`); }

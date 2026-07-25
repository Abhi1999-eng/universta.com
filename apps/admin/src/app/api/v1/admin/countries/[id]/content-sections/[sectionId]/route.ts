import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; sectionId: string }> };
export async function PATCH(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `editorial:PATCH:${p.id}:sections:${p.sectionId}`); }
export async function DELETE(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `editorial:DELETE:${p.id}:sections:${p.sectionId}`); }

import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
type Context = { params: Promise<{ id: string; levelId: string }> };
export async function GET(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subjects:level-pages:get:${p.id}:${p.levelId}`); }
export async function PUT(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subjects:level-pages:put:${p.id}:${p.levelId}`); }
export async function DELETE(request: NextRequest, context: Context) { const p = await context.params; return proxyCatalogRoute(request, `subjects:level-pages:delete:${p.id}:${p.levelId}`); }

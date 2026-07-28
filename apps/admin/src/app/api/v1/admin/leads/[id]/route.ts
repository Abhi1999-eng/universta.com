import type { NextRequest } from 'next/server';
import { proxyLeadRoute } from '@/lib/server/leads-proxy';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  return proxyLeadRoute(request, `detail:${(await context.params).id}`);
}

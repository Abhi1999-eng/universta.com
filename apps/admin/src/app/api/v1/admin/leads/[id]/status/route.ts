import type { NextRequest } from 'next/server';
import { proxyLeadRoute } from '@/lib/server/leads-proxy';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  return proxyLeadRoute(request, `status:${(await context.params).id}`);
}

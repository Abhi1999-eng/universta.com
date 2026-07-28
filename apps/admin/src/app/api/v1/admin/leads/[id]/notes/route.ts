import type { NextRequest } from 'next/server';
import { proxyLeadRoute } from '@/lib/server/leads-proxy';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  return proxyLeadRoute(request, `notes:${(await context.params).id}`);
}

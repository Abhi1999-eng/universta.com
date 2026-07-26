import type { NextRequest } from 'next/server';
import { proxyLeadRoute } from '@/lib/server/leads-proxy';

export function GET(request: NextRequest) {
  return proxyLeadRoute(request, 'list');
}

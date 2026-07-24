import { proxyAuthRoute } from '@/lib/server/auth-proxy';
import type { NextRequest } from 'next/server';

export function GET(request: NextRequest) {
  return proxyAuthRoute(request, 'me');
}

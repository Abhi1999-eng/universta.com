import { proxyAuthRoute } from '@/lib/server/auth-proxy';
import type { NextRequest } from 'next/server';

export function POST(request: NextRequest) {
  return proxyAuthRoute(request, 'logout');
}

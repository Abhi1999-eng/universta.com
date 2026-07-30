import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
import { proxySimpleAdmin } from '@/lib/server/simple-admin-proxy';

export function GET(request: NextRequest) {
  const { search } = new URL(request.url);
  // Plain "give me every active intake" (no filters) keeps using the
  // original dropdown-feeding proxy; a real q/status filter routes to the
  // fuller admin list added alongside create/update/archive below.
  if (!search) return proxyCatalogRoute(request, 'intakes:list');
  return proxySimpleAdmin(request, 'GET', 'intakes');
}
export function POST(request: NextRequest) {
  return proxySimpleAdmin(request, 'POST', 'intakes');
}

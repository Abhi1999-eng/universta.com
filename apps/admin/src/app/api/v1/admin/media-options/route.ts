import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';
export async function GET(request: NextRequest) { return proxyCatalogRoute(request, 'editorial:GET::media-options'); }

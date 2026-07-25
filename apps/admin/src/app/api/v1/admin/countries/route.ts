import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';

export function GET(request: NextRequest) { return proxyCatalogRoute(request, 'countries:list'); }
export function POST(request: NextRequest) { return proxyCatalogRoute(request, 'countries:create'); }

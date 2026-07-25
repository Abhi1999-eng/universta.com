import type { NextRequest } from 'next/server';
import { proxyCatalogRoute } from '@/lib/server/catalog-proxy';

export function GET(request: NextRequest) { return proxyCatalogRoute(request, 'continents:list'); }
export function POST(request: NextRequest) { return proxyCatalogRoute(request, 'continents:create'); }

import type { NextRequest } from 'next/server';
import { proxyPhase1Admin } from '@/lib/server/phase1-proxy';
type Context = { params: Promise<{ segments: string[] }> };
export async function GET(request: NextRequest, context: Context) { return proxyPhase1Admin(request, (await context.params).segments); }
export async function POST(request: NextRequest, context: Context) { return proxyPhase1Admin(request, (await context.params).segments); }
export async function PATCH(request: NextRequest, context: Context) { return proxyPhase1Admin(request, (await context.params).segments); }
export async function DELETE(request: NextRequest, context: Context) { return proxyPhase1Admin(request, (await context.params).segments); }

import { NextResponse } from 'next/server';

/**
 * The three master lists the onboarding form needs, fetched server-side in one
 * round trip. They are public catalogue data, but the portal should not have
 * to know the API's address or make three calls to fill three selects.
 */

const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000';

async function list(path: string): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetch(new URL(path, API_BASE), { cache: 'no-store' });
    if (!response.ok) return [];
    const body: unknown = await response.json();
    const rows = (body as { data?: Array<{ id?: string; name?: string }> })?.data;
    return (rows ?? [])
      .filter((row) => row.id && row.name)
      .map((row) => ({ id: String(row.id), name: String(row.name) }));
  } catch {
    return [];
  }
}

export async function GET() {
  const [countries, subjects, courseLevels] = await Promise.all([
    list('/api/v1/countries?limit=100'),
    list('/api/v1/subjects?limit=100'),
    list('/api/v1/course-levels'),
  ]);
  return NextResponse.json(
    { data: { countries, subjects, courseLevels }, meta: null, error: null },
    { headers: { 'cache-control': 'no-store' } },
  );
}

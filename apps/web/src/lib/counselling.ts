import 'server-only';

export interface CounsellingOptions {
  countries: Array<{ slug: string; name: string }>;
  courseLevels: Array<{ code: string; name: string }>;
  intakes: Array<{ slug: string; name: string; shortLabel: string | null }>;
}

type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string; details: unknown } | null;
};

export async function getCounsellingOptions(): Promise<CounsellingOptions | null> {
  const url = new URL(
    '/api/v1/public/counselling-leads/options',
    process.env.API_BASE_URL ?? 'http://127.0.0.1:4000',
  );
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const body = (await response.json()) as ApiEnvelope<CounsellingOptions>;
    return response.ok && !body.error && body.data ? body.data : null;
  } catch {
    return null;
  }
}

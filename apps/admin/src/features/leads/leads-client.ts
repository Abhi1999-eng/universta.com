import { authFetch } from '@/features/auth/auth-client';
import {
  LeadClientError,
  type LeadDetail,
  type LeadListParams,
  type LeadNote,
  type LeadOptions,
  type LeadRecord,
  type PageMeta,
} from './leads.types';

type Envelope<T> = {
  data: T | null;
  meta: PageMeta | null;
  error: { code: string; message: string; details: unknown } | null;
  requestId: string;
};

function queryString(params: LeadListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

async function read<T>(response: Response): Promise<Envelope<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LeadClientError('The lead service returned an invalid response.', {
      code: 'LEAD_SERVICE_UNAVAILABLE',
      status: response.status,
    });
  }
  if (!body || typeof body !== 'object' || !('data' in body)) {
    throw new LeadClientError('The lead service returned an invalid response.', {
      code: 'LEAD_SERVICE_UNAVAILABLE',
      status: response.status,
    });
  }
  const envelope = body as Envelope<T>;
  if (!response.ok || envelope.error || envelope.data === null) {
    throw new LeadClientError(
      envelope.error?.message ?? 'The lead request could not be completed.',
      {
        code: envelope.error?.code ?? 'LEAD_REQUEST_FAILED',
        status: response.status,
        details: envelope.error?.details,
        requestId: envelope.requestId,
      },
    );
  }
  return envelope;
}

export async function listLeads(
  params: LeadListParams,
  signal?: AbortSignal,
): Promise<{ data: LeadRecord[]; meta: PageMeta }> {
  const query = queryString(params);
  const response = await authFetch(`/api/v1/admin/leads${query ? `?${query}` : ''}`, {
    signal,
  });
  const envelope = await read<LeadRecord[]>(response);
  if (!envelope.meta) {
    throw new LeadClientError('Lead pagination information is unavailable.', {
      code: 'LEAD_RESPONSE_INVALID',
      status: response.status,
    });
  }
  return { data: envelope.data!, meta: envelope.meta };
}

export async function getLeadOptions(
  signal?: AbortSignal,
): Promise<LeadOptions> {
  return (
    await read<LeadOptions>(
      await authFetch('/api/v1/admin/leads/options', { signal }),
    )
  ).data!;
}

export async function getLead(
  id: string,
  signal?: AbortSignal,
): Promise<LeadDetail> {
  return (
    await read<LeadDetail>(
      await authFetch(`/api/v1/admin/leads/${encodeURIComponent(id)}`, {
        signal,
      }),
    )
  ).data!;
}

export async function updateLeadStatus(
  id: string,
  status: string,
  expectedUpdatedAt: string,
  reason?: string,
): Promise<LeadRecord> {
  return (
    await read<LeadRecord>(
      await authFetch(`/api/v1/admin/leads/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status,
          expectedUpdatedAt,
          reason: reason?.trim() || undefined,
        }),
      }),
    )
  ).data!;
}

export async function createLeadNote(
  id: string,
  note: string,
  isPinned: boolean,
): Promise<LeadNote> {
  return (
    await read<LeadNote>(
      await authFetch(`/api/v1/admin/leads/${encodeURIComponent(id)}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: note.trim(), isPinned }),
      }),
    )
  ).data!;
}

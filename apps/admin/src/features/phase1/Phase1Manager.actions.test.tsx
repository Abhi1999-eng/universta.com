import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1Manager } from './Phase1Manager';

/**
 * A row shows its status, offers the one publishing action that applies,
 * says what it is doing while it runs, and a toast says what happened.
 * Archive sits behind "More actions" so it cannot be hit by mistake.
 */

const rows = [
  { id: 'id-a', name: 'Alpha University', slug: 'alpha-university', status: 'PUBLISHED', updatedAt: '2026-10-01T10:00:00.000Z' },
  { id: 'id-b', name: 'Beta University', slug: 'beta-university', status: 'DRAFT', updatedAt: '2026-10-02T10:00:00.000Z' },
];
const calls: Array<{ url: string; method: string }> = [];
const authFetch = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/phase1/universities',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => authFetch(input, init),
}));
vi.mock('@/lib/web-origin', () => ({ webOrigin: () => 'https://site.test' }));

function ok(data: unknown, meta: unknown = null, status = 200) {
  return { ok: status < 400, status, json: async () => ({ data, meta, error: null, requestId: 'test' }) } as unknown as Response;
}
function fail(message: string) {
  return { ok: false, status: 409, json: async () => ({ data: null, meta: null, error: { code: 'NOT_READY', message }, requestId: 'test' }) } as unknown as Response;
}

beforeEach(() => {
  calls.length = 0;
  // The API remembers what it was told, as the real one does.
  const state = rows.map((row) => ({ ...row }));
  authFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('form-options')) return ok({ campuses: [], countries: [], subjects: [], courses: [], universities: [], courseLevels: [], studyModes: [], intakes: [], consultants: [] });
    const detail = state.find((row) => url.includes(`/${row.id}`));
    if (method === 'POST' && detail && url.endsWith('/publish')) {
      if (detail.id === 'id-a') return fail('Overview is required before publishing');
      detail.status = 'PUBLISHED';
      return ok(detail);
    }
    if (method === 'POST' && detail && url.endsWith('/unpublish')) {
      detail.status = 'DRAFT';
      return ok(detail);
    }
    if (method === 'GET' && detail && url.endsWith(`/${detail.id}`)) return ok(detail);
    if (url.includes('status=PUBLISHED')) { const hits = state.filter((row) => row.status === 'PUBLISHED'); return ok(hits.slice(0, 1), { page: 1, limit: 1, total: hits.length, totalPages: 1 }); }
    if (url.includes('status=DRAFT')) { const hits = state.filter((row) => row.status === 'DRAFT'); return ok(hits.slice(0, 1), { page: 1, limit: 1, total: hits.length, totalPages: 1 }); }
    return ok(state, { page: 1, limit: 20, total: 2, totalPages: 1 });
  });
});
afterEach(() => vi.restoreAllMocks());

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

describe('the shared records list', () => {
  it('shows each row its status, and only the publishing action that applies', async () => {
    render(<Phase1Manager resource="universities" />);
    const alpha = await rowOf('Alpha University');
    expect(within(alpha).getByText('Published')).toBeInTheDocument();
    expect(within(alpha).getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
    expect(within(alpha).queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(within(alpha).getByRole('link', { name: /View on site/ })).toHaveAttribute('href', 'https://site.test/universities/alpha-university');
    const beta = await rowOf('Beta University');
    expect(within(beta).getByText('Draft')).toBeInTheDocument();
    expect(within(beta).getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(within(beta).queryByRole('button', { name: 'Unpublish' })).toBeNull();
    expect(within(beta).queryByRole('link', { name: /View on site/ })).toBeNull();
    // Archive is not a button on the row.
    expect(within(beta).queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.getByText('2 records')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('· 1 published')).toBeInTheDocument());
  });

  it('publishes a draft, flips its badge and says so in a toast', async () => {
    render(<Phase1Manager resource="universities" />);
    const beta = await rowOf('Beta University');
    await userEvent.click(within(beta).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Beta University published.'));
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/universities/id-b/publish'))).toBe(true);
  });

  it('keeps a failed publish on the row, with the reason and the editor one click away', async () => {
    render(<Phase1Manager resource="universities" />);
    const alpha = await rowOf('Alpha University');
    // Make Alpha a draft first so Publish is offered, then let the API refuse it.
    await userEvent.click(within(alpha).getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(within(alpha).getByRole('button', { name: 'Publish' })).toBeInTheDocument());
    await userEvent.click(within(alpha).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Overview is required before publishing'));
    await userEvent.click(screen.getByRole('button', { name: 'Fix in editor' }));
    expect(await screen.findByRole('form', { name: /Edit universities/i })).toBeInTheDocument();
  });

  it('keeps Archive behind the More actions menu and asks before archiving', async () => {
    render(<Phase1Manager resource="universities" />);
    const beta = await rowOf('Beta University');
    await userEvent.click(within(beta).getByRole('button', { name: 'More actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Archive this record?');
  });
});

describe('bulk publishing on the shared records list', () => {
  it('publishes every ticked draft at once and sums it up in one toast', async () => {
    render(<Phase1Manager resource="universities" />);
    await rowOf('Beta University');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publish 2' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 published · 1 already published.'));
    // Only the draft was sent; the published one was left alone.
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/publish')).map((c) => c.url.split('/').at(-2))).toEqual(['id-b']);
  });
});

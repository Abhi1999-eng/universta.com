import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1Manager } from './Phase1Manager';

/** ISS-032. The list request never sent page/limit at all, so the API's own
 * default (12) silently capped every resource with no pagination UI to reach
 * anything past it -- a 13th record was simply invisible, and "N records"
 * quietly understated the true total. */

const calls: Array<{ url: string }> = [];
const authFetch = vi.fn();
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL) => authFetch(input),
}));

function jsonResponse(data: unknown, meta: unknown = null) {
  return {
    ok: true,
    json: async () => ({ data, error: null, meta, requestId: 'test' }),
  } as unknown as Response;
}

function rowsFor(page: number) {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `id-${page}-${i}`,
    name: `University p${page}-${i}`,
  }));
}

beforeEach(() => {
  calls.length = 0;
  authFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push({ url });
    if (url.includes('form-options')) return jsonResponse({});
    const pageMatch = /page=(\d+)/.exec(url);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    return jsonResponse(rowsFor(page), { page, limit: 20, total: 45, totalPages: 3 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Phase1Manager pagination', () => {
  it('requests page and limit query params on the initial load', async () => {
    render(<Phase1Manager resource="universities" />);
    await waitFor(() =>
      expect(calls.some((c) => /page=1&limit=20/.test(c.url) || /limit=20&page=1/.test(c.url))).toBe(true),
    );
  });

  it('shows the true total from the API, not just the rows on this page', async () => {
    render(<Phase1Manager resource="universities" />);
    await screen.findByText('University p1-0');
    expect(await screen.findByText('45 records')).toBeInTheDocument();
  });

  it('shows Previous/Next controls and a page indicator when more than one page exists', async () => {
    render(<Phase1Manager resource="universities" />);
    await screen.findByText('University p1-0');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('advances to the next page and requests it from the API', async () => {
    const user = userEvent.setup();
    render(<Phase1Manager resource="universities" />);
    await screen.findByText('University p1-0');

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByText('University p2-0');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(calls.some((c) => c.url.includes('page=2'))).toBe(true);
  });

  it('resets to page 1 when switching resources', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Phase1Manager resource="universities" />);
    await screen.findByText('University p1-0');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Page 2 of 3');

    rerender(<Phase1Manager resource="scholarships" />);

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('scholarships') && c.url.includes('page=1'))).toBe(true),
    );
  });
});

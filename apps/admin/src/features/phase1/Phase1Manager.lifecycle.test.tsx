import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1Manager } from './Phase1Manager';

/** What each row says beside "Published": SS-C8, JOB-C1, EV-M8, T-C10. */

const authFetch = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/phase1/events',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL) => authFetch(input),
}));

let rows: Array<Record<string, unknown>> = [];
function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data, error: null, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 }, requestId: 'test' }),
  } as unknown as Response;
}
const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

beforeEach(() => {
  authFetch.mockImplementation(async () => jsonResponse(rows));
});
afterEach(() => {
  vi.restoreAllMocks();
});

const row = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;

describe('Phase1Manager rows', () => {
  it('marks a scheduled story and gives it no View on site link', async () => {
    rows = [
      { id: 's-1', title: 'Later story', slug: 'later-story', status: 'PUBLISHED', publishStartsAt: iso(30 * day) },
      { id: 's-2', title: 'Live story', slug: 'live-story', status: 'PUBLISHED' },
    ];
    render(<Phase1Manager resource="success-stories" />);
    const later = await row('Later story');
    expect(within(later).getByText(/^Scheduled \(goes live /)).toBeTruthy();
    expect(within(later).queryByText(/View on site/)).toBeNull();
    expect(within(await row('Live story')).getByText(/View on site/)).toBeTruthy();
  });

  it('marks a role closed after its closing day and still links it', async () => {
    rows = [{ id: 'j-1', title: 'Closed role', slug: 'closed-role', status: 'PUBLISHED', expiryDate: iso(-3 * day).slice(0, 10) + 'T00:00:00.000Z' }];
    render(<Phase1Manager resource="jobs" />);
    const closed = await row('Closed role');
    expect(within(closed).getByText('Closed')).toBeTruthy();
    expect(within(closed).getByText(/View on site/)).toBeTruthy();
  });

  it('gives each event its start, and marks one that has ended', async () => {
    rows = [
      { id: 'e-1', title: 'Past fair', slug: 'past-fair', status: 'PUBLISHED', startsAt: '2026-01-10T09:00:00.000Z', endsAt: null, timezone: 'Asia/Tokyo' },
      { id: 'e-2', title: 'Next fair', slug: 'next-fair', status: 'PUBLISHED', startsAt: iso(10 * day), timezone: 'Asia/Kolkata' },
    ];
    render(<Phase1Manager resource="events" />);
    const past = await row('Past fair');
    expect(within(past).getByTestId('event-start').textContent).toBe('10 Jan 2026, 18:00');
    expect(within(past).getByText('Ended')).toBeTruthy();
    expect(within(await row('Next fair')).queryByText('Ended')).toBeNull();
  });

  it('names a testimonial by its quote and who said it, and searches both', async () => {
    rows = [{ id: 't-1', quote: 'They answered every question.', attribution: 'Asha', status: 'PUBLISHED' }];
    render(<Phase1Manager resource="testimonials" />);
    expect(await screen.findByText('They answered every question. — Asha')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search quote or student name')).toBeTruthy();
  });
});

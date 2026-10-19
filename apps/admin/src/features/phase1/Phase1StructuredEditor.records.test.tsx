import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1StructuredEditor } from './Phase1StructuredEditor';

/**
 * What the shared record editor sends for events, jobs, stories,
 * testimonials and consultants -- each case here was a save that moved,
 * froze, lost or refused something the editor never touched.
 */

type Row = Record<string, unknown>;
const authFetch = vi.fn();
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => authFetch(input, init),
}));

const sent: Array<{ method: string; url: string; body: Row }> = [];
let record: Row | null = null;
let refusal: { code: string; message: string } | null = null;

function reply(ok: boolean, data: unknown, error: unknown = null) {
  return { ok, json: async () => ({ data, error, meta: null, requestId: 'test' }) } as unknown as Response;
}

const options = {
  countries: [
    { id: 'country-1', name: 'Japan', slug: 'japan', status: 'PUBLISHED' },
    { id: 'country-2', name: 'Atlantis', slug: 'atlantis', status: 'DRAFT' },
  ],
  universities: [],
  offerings: [],
  courses: [],
  levels: [],
  modes: [],
  intakes: [],
  locations: [
    { id: 'loc-1', name: 'Rajouri Garden', city: 'Delhi' },
    { id: 'loc-2', name: 'Koramangala', city: 'Bengaluru' },
  ],
  providers: [],
  media: [],
  campuses: [],
  states: [],
  cities: [],
};

beforeEach(() => {
  sent.length = 0;
  record = null;
  refusal = null;
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.endsWith('/form-options')) return reply(true, options);
    /* Every stored record has a display order; the form insists on one. */
    if (method === 'GET') return reply(true, record ? { displayOrder: 0, ...record } : record);
    const body = JSON.parse(String(init?.body ?? '{}')) as Row;
    sent.push({ method, url, body });
    if (refusal) return reply(false, null, refusal);
    return reply(true, { id: 'saved-1', ...body });
  });
});

function open(resource: string, recordId?: string) {
  render(<Phase1StructuredEditor resource={resource} recordId={recordId} onSaved={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);
}
async function form() {
  const node = await screen.findByRole('form');
  await waitFor(() => expect(within(node).queryByText('Loading record…')).toBeNull());
  return node;
}
const input = (scope: HTMLElement, label: string) => within(scope).getByLabelText(label, { exact: true }) as HTMLInputElement;
async function save(scope: HTMLElement) {
  await userEvent.click(within(scope).getByRole('button', { name: /^(Save changes|Create draft)$/ }));
}

describe('dates and times', () => {
  /* EV-C2. A Tokyo event at 18:00 was read and written in UTC by slicing the
     ISO string, and every save shifted it by the server's offset. */
  it('opens an event in its own zone and sends an unchanged save back exactly', async () => {
    record = {
      id: 'event-1',
      title: 'Tokyo fair',
      slug: 'tokyo-fair',
      status: 'PUBLISHED',
      timezone: 'Asia/Tokyo',
      eventType: 'OFFLINE',
      startsAt: '2026-11-05T09:00:00.000Z',
      endsAt: '2026-11-05T11:30:15.000Z',
      publishStartsAt: '2026-10-31T18:30:00.000Z',
      publishEndsAt: null,
    };
    open('events', 'event-1');
    const scope = await form();
    expect(input(scope, 'Start date and time').value).toBe('2026-11-05T18:00');
    expect(input(scope, 'End date and time').value).toBe('2026-11-05T20:30');
    expect(input(scope, 'Publish from (optional)').value).toBe('2026-11-01T00:00');
    await save(scope);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toMatchObject({
      startsAt: '2026-11-05T09:00:00.000Z',
      endsAt: '2026-11-05T11:30:15.000Z',
      publishStartsAt: '2026-10-31T18:30:00.000Z',
      publishEndsAt: null,
      timezone: 'Asia/Tokyo',
    });
  });

  it('reads 18:00 typed for a Tokyo event as 18:00 in Tokyo', async () => {
    open('events');
    const scope = await form();
    await userEvent.type(input(scope, 'Title'), 'Tokyo evening');
    await userEvent.selectOptions(input(scope, 'Timezone'), 'Asia/Tokyo');
    await userEvent.type(input(scope, 'Start date and time'), '2026-11-05T18:00');
    await save(scope);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body.startsAt).toBe('2026-11-05T09:00:00.000Z');
  });

  /* EV-M4. Publish from and Publish until moved on every save of every
     structured record, not only events. */
  it('keeps a role’s publishing window on an unchanged save', async () => {
    record = {
      id: 'job-1',
      title: 'Counsellor',
      slug: 'counsellor',
      status: 'DRAFT',
      publishStartsAt: '2026-10-31T18:30:00.000Z',
      publishEndsAt: '2026-12-31T12:00:00.000Z',
      applicationUrl: 'https://careers.example.com/apply',
    };
    open('jobs', 'job-1');
    const scope = await form();
    expect(input(scope, 'Publish until (optional)').value).toBe('2026-12-31T17:30');
    await save(scope);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].body).toMatchObject({
      publishStartsAt: '2026-10-31T18:30:00.000Z',
      publishEndsAt: '2026-12-31T12:00:00.000Z',
    });
  });

  /* EV-C3. A zone saved before the list existed stays as it was. */
  it('keeps an older event’s unknown zone without sending it', async () => {
    record = { id: 'event-2', title: 'Old', slug: 'old', status: 'DRAFT', timezone: 'Tokyo', eventType: 'WORKSHOP', startsAt: '2026-11-05T09:00:00.000Z' };
    open('events', 'event-2');
    const scope = await form();
    expect(input(scope, 'Timezone').value).toBe('Tokyo');
    expect(within(scope).getByRole('option', { name: 'Tokyo (older value)' })).toBeTruthy();
    /* EV-C9. A webinar-style kind reads as itself, not as In person. */
    expect(input(scope, 'Event type').value).toBe('WORKSHOP');
    expect(within(scope).getByRole('option', { name: 'Workshop (older value)' })).toBeTruthy();
    expect(within(scope).getByRole('option', { name: 'In person' })).toBeTruthy();
    await save(scope);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect('timezone' in sent[0].body).toBe(false);
    expect(sent[0].body.eventType).toBe('WORKSHOP');
  });

  it('shows the API’s time zone refusal under the field', async () => {
    record = { id: 'event-3', title: 'Fair', slug: 'fair', status: 'DRAFT', timezone: 'Asia/Kolkata', startsAt: '2026-11-05T09:00:00.000Z' };
    refusal = { code: 'INVALID_TIMEZONE', message: '"Mars/Base" is not a time zone.' };
    open('events', 'event-3');
    const scope = await form();
    await save(scope);
    await waitFor(() => expect(within(scope).getAllByText('"Mars/Base" is not a time zone.')).toHaveLength(2));
  });
});


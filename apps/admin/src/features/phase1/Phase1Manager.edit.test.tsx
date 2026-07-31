import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1Manager } from './Phase1Manager';

/** Clicking Edit on a row must open *that* row.
 *
 * The editor is rendered in place rather than remounted per target, so React
 * reused the mounted instance when the row changed: opening B after A kept A's
 * values on screen, and switching from a row to Create left the new-record form
 * pre-filled with the last edited row. These tests pin each direction. */

const RECORDS: Record<string, Record<string, unknown>> = {
  'id-a': {
    id: 'id-a',
    name: 'Alpha University',
    slug: 'alpha-university',
    status: 'PUBLISHED',
    isFeatured: true,
  },
  'id-b': {
    id: 'id-b',
    name: 'Beta University',
    slug: 'beta-university',
    status: 'DRAFT',
    isFeatured: false,
  },
};

const calls: Array<{ url: string; method: string; body?: string }> = [];

/** Both the list and the editor talk to the API through `authFetch`, so that is
 * what the test intercepts -- stubbing global fetch would miss it. */
const authFetch = vi.fn();
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    authFetch(input, init),
}));

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => ({ data, error: null, meta: null, requestId: 'test' }),
  } as unknown as Response;
}

beforeEach(() => {
  calls.length = 0;
  authFetch.mockImplementation(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      if (url.includes('form-options')) {
        return jsonResponse({
          campuses: [],
          countries: [],
          subjects: [],
          courses: [],
          universities: [],
          courseLevels: [],
          studyModes: [],
          intakes: [],
          consultants: [],
        });
      }
      const detail = Object.keys(RECORDS).find((id) => url.endsWith(`/${id}`));
      if (detail && (init?.method ?? 'GET') === 'GET') {
        return jsonResponse(RECORDS[detail]);
      }
      if (init?.method === 'PATCH') return jsonResponse({ id: detail });
      // The list.
      return jsonResponse(Object.values(RECORDS));
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openEditFor(name: string) {
  const row = (await screen.findByText(name)).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
}

/** The Name field of whichever editor is currently open, scoped to the editor
 * form so the surrounding list cannot satisfy the query. */
async function editorNameValue(): Promise<string> {
  const form = await screen.findByRole('form', {
    name: /(Edit|Create) universities/i,
  });
  const field = within(form).getByLabelText(/^Name/i) as HTMLInputElement;
  return field.value;
}

describe('Phase1Manager edit targeting', () => {
  it('opens record A when Edit is clicked on record A', async () => {
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Alpha University');

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.url.endsWith('/id-a') && call.method === 'GET',
        ),
      ).toBe(true),
    );
    expect(await editorNameValue()).toBe('Alpha University');
  });

  it('opens record B when Edit is clicked on record B', async () => {
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Beta University');

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.url.endsWith('/id-b') && call.method === 'GET',
        ),
      ).toBe(true),
    );
    expect(await editorNameValue()).toBe('Beta University');
  });

  it('shows B only, after A was opened first', async () => {
    // The reported failure: A's values persisting into B's editor.
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Alpha University');
    await waitFor(async () =>
      expect(await editorNameValue()).toBe('Alpha University'),
    );

    await openEditFor('Beta University');

    await waitFor(async () =>
      expect(await editorNameValue()).toBe('Beta University'),
    );
    expect(screen.queryByDisplayValue('Alpha University')).toBeNull();
  });

  it('prepopulates the record’s own values, not just its name', async () => {
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Beta University');
    await waitFor(() =>
      expect(screen.getByDisplayValue('beta-university')).toBeTruthy(),
    );
  });

  it('labels the editor as Edit rather than Create', async () => {
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Alpha University');
    await waitFor(() =>
      expect(
        screen.getByRole('form', { name: /Edit universities/i }),
      ).toBeTruthy(),
    );
  });

  it('does not leak an edited record into the Create form', async () => {
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Alpha University');
    await waitFor(async () =>
      expect(await editorNameValue()).toBe('Alpha University'),
    );

    await userEvent.click(
      screen.getByRole('button', { name: /^Create record$/ }),
    );

    await waitFor(() =>
      expect(screen.queryByDisplayValue('Alpha University')).toBeNull(),
    );
  });

  it('does not leak Create state into a subsequent edit', async () => {
    render(<Phase1Manager resource="universities" />);
    await userEvent.click(
      screen.getByRole('button', { name: /^Create record$/ }),
    );
    await screen.findByRole('form', { name: /Create universities/i });

    await openEditFor('Beta University');

    await waitFor(async () =>
      expect(await editorNameValue()).toBe('Beta University'),
    );
  });

  it('re-fetches the target record each time an editor is opened', async () => {
    // Proves the editor is not being reused with stale data.
    render(<Phase1Manager resource="universities" />);
    await openEditFor('Alpha University');
    await waitFor(() =>
      expect(calls.filter((call) => call.url.endsWith('/id-a')).length).toBe(1),
    );
    await openEditFor('Beta University');
    await waitFor(() =>
      expect(calls.filter((call) => call.url.endsWith('/id-b')).length).toBe(1),
    );
    await openEditFor('Alpha University');
    await waitFor(() =>
      expect(calls.filter((call) => call.url.endsWith('/id-a')).length).toBe(2),
    );
  });
});

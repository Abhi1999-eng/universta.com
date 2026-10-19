import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1StructuredEditor } from './Phase1StructuredEditor';

/**
 * Every programme page said "Needs verification" and "Course code: Not
 * listed", and the offering form had no field for either. It has both now,
 * the date with the same control and the same rule as a university's: no
 * date in the future.
 */

const authFetch = vi.fn();
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => authFetch(input, init),
}));

function response(ok: boolean, data: unknown, message?: string) {
  return {
    ok,
    json: async () => ({ data, error: message ? { message } : null, meta: null, requestId: 'test' }),
  } as unknown as Response;
}

const offering = {
  id: 'offering-1',
  name: 'MIST',
  slug: 'mist-at-the-university-of-tokyo',
  universityId: 'u1',
  genericCourseId: 'c1',
  courseLevelId: 'l1',
  courseCode: 'IST-M',
  verifiedAt: '2026-10-06T00:00:00.000Z',
  status: 'DRAFT',
  displayOrder: 0,
  intakes: [],
  requirements: [],
};

const sent: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  sent.length = 0;
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, init });
    if (url.endsWith('/form-options'))
      return response(true, {
        countries: [],
        universities: [{ id: 'u1', name: 'University of Tokyo' }],
        offerings: [],
        courses: [{ id: 'c1', name: 'MIST' }],
        levels: [{ id: 'l1', name: "Master's" }],
        modes: [],
        intakes: [],
        locations: [],
        providers: [],
        media: [],
        campuses: [],
        states: [],
        cities: [],
      });
    if (init?.method === 'PATCH') return response(true, { ...offering });
    return response(true, offering);
  });
});

function mount() {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <Phase1StructuredEditor resource="offerings" recordId="offering-1" onSaved={onSaved} onCancel={vi.fn()} />,
  );
  return onSaved;
}

describe('the offering form', () => {
  it('has a Course code and a Verified date, filled from the record', async () => {
    mount();
    const code = (await screen.findByLabelText(/^Course code/i)) as HTMLInputElement;
    await waitFor(() => expect(code.value).toBe('IST-M'));
    const verified = screen.getByLabelText(/^Verified date/i) as HTMLInputElement;
    expect(verified.type).toBe('date');
    expect(verified.value).toBe('2026-10-06');
  });

  it('saves both, the date as a calendar day', async () => {
    const onSaved = mount();
    const code = (await screen.findByLabelText(/^Course code/i)) as HTMLInputElement;
    await waitFor(() => expect(code.value).toBe('IST-M'));
    fireEvent.change(code, { target: { value: 'IST-M2' } });
    fireEvent.change(screen.getByLabelText(/^Verified date/i), { target: { value: '2026-10-01' } });
    fireEvent.submit(code.closest('form')!);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const patch = sent.find((entry) => entry.init?.method === 'PATCH')!;
    const body = JSON.parse(String(patch.init!.body)) as Record<string, unknown>;
    expect(body.courseCode).toBe('IST-M2');
    expect(body.verifiedAt).toBe('2026-10-01');
  });

  it('clears both when they are emptied', async () => {
    const onSaved = mount();
    const code = (await screen.findByLabelText(/^Course code/i)) as HTMLInputElement;
    await waitFor(() => expect(code.value).toBe('IST-M'));
    fireEvent.change(code, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/^Verified date/i), { target: { value: '' } });
    fireEvent.submit(code.closest('form')!);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(String(sent.find((entry) => entry.init?.method === 'PATCH')!.init!.body));
    expect(body.courseCode).toBeNull();
    expect(body.verifiedAt).toBeNull();
  });

  it('refuses a verified date in the future, as a university’s does', async () => {
    const onSaved = mount();
    const code = (await screen.findByLabelText(/^Course code/i)) as HTMLInputElement;
    await waitFor(() => expect(code.value).toBe('IST-M'));
    fireEvent.change(screen.getByLabelText(/^Verified date/i), { target: { value: '2999-01-01' } });
    fireEvent.submit(code.closest('form')!);
    expect(await screen.findByText('Verified date cannot be in the future.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(sent.some((entry) => entry.init?.method === 'PATCH')).toBe(false);
  });
});

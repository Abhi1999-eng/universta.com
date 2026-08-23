import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Phase1StructuredEditor } from './Phase1StructuredEditor';

const authFetch = vi.fn();
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    authFetch(input, init),
}));

function response(ok: boolean, data: unknown, message?: string) {
  return {
    ok,
    json: async () => ({
      data,
      error: message ? { message } : null,
      meta: null,
      requestId: 'test',
    }),
  } as unknown as Response;
}

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/form-options')) {
      return response(true, {
        countries: [],
        universities: [],
        offerings: [],
        courses: [],
        levels: [],
        modes: [],
        intakes: [],
        locations: [],
        providers: [],
        media: [],
        campuses: [],
        states: [],
        cities: [],
      });
    }
    return response(false, null, 'Internal server error');
  });
});

describe('Phase1StructuredEditor failed detail load', () => {
  it('shows a danger alert and keeps the blank form disabled', async () => {
    render(
      <Phase1StructuredEditor
        resource="universities"
        recordId="university-1"
        onSaved={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Internal server error');
    expect(alert.className).toContain('bg-[#FEF3F2]');

    const name = screen.getByLabelText(/^Name/i) as HTMLInputElement;
    const fieldset = name.closest('fieldset') as HTMLFieldSetElement | null;
    expect(fieldset).not.toBeNull();
    await waitFor(() => expect(fieldset?.disabled).toBe(true));
    expect(screen.getByTestId('structured-editor-sections')).toHaveClass('space-y-6');
    expect(screen.getByRole('button', { name: 'Retry loading' })).toBeTruthy();
  });
});

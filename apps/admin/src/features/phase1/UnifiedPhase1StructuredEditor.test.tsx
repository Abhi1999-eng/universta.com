import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnifiedPhase1StructuredEditor } from './UnifiedPhase1StructuredEditor';

const empty = { countries: [], universities: [], offerings: [], courses: [], levels: [], modes: [], intakes: [], locations: [], providers: [], media: [], campuses: [], states: [], cities: [] };
vi.mock('@/features/auth/auth-client', () => ({
  authFetch: async (input: RequestInfo | URL) =>
    ({
      ok: true,
      json: async () => ({
        data: String(input).endsWith('/form-options') ? empty : { id: 'c-1', name: 'Demo', slug: 'demo', status: 'PUBLISHED', displayOrder: 0 },
        error: null,
      }),
    }) as unknown as Response,
}));

/* CON-C10. The Save draft button was announced as "Save changes": on a
   published consultant it takes the record off the site. */
describe('the unified editor’s actions', () => {
  it('names Save draft by its own words', async () => {
    render(<UnifiedPhase1StructuredEditor resource="consultants" recordId="c-1" onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Save draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeTruthy();
  });
});

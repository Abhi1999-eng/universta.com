import { describe, expect, it } from 'vitest';
import ConsultantLocations from './page';

describe('the bare consultant locations address', () => {
  it('moves permanently to the directory\'s cities, rather than a "Consultant not found" page', () => {
    let digest = '';
    try {
      ConsultantLocations();
    } catch (error) {
      digest = String((error as { digest?: unknown }).digest ?? '');
    }
    expect(digest).toContain('NEXT_REDIRECT');
    expect(digest).toContain('/study-abroad-consultants#cities');
    expect(digest).toContain('308');
  });
});

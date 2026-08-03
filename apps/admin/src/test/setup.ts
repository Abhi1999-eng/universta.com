import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The suite also covers Node-environment tests (the Playwright cleanup
// helpers), which have no window to stub.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'http://localhost:3001',
      pathname: '/',
      search: '',
      assign: vi.fn(),
      replace: vi.fn(),
    },
  });
  // jsdom does not implement scrollIntoView at all.
  Element.prototype.scrollIntoView = vi.fn();
}

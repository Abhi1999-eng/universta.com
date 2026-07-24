import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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

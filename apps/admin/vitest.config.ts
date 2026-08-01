import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      // Playwright's own helpers issue deleteMany against a real database, so
      // their ownership and safety guards are unit-tested here rather than
      // only exercised as a side effect of an e2e run.
      'e2e/helpers/**/*.test.ts',
    ],
    exclude: ['e2e/helpers/**/*.db.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});

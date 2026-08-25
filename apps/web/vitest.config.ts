import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Only the path alias. Everything else stays on Vitest's defaults so test
 * discovery is unchanged; component tests that import runtime helpers through
 * `@/lib/...` could not resolve them without this.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

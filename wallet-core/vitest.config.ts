import { defineConfig } from 'vitest/config';

// `npm test` roda só testes offline e determinísticos. Os que usam a rede ficam em test-live/.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'test-live/**'],
  },
});

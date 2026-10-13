import { defineConfig } from 'vitest/config';

// Testes que usam a rede de verdade (scanner de blockchain). Rodam à parte: `npm run test:live`.
export default defineConfig({
  test: {
    include: ['test-live/**/*.live.test.ts'],
    testTimeout: 60_000,
    fileParallelism: false,
  },
});

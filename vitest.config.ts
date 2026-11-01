import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/golden/**', '**/node_modules/**', 'legacy/**'],
    testTimeout: 60000,
  },
});

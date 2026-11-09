import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/golden/**', 'tests/balance/**', '**/node_modules/**'],
    testTimeout: 60000,
    // full-life tests keep a worker busy for many seconds; fewer workers in their own processes keep the worker RPC from timing out
    pool: 'forks',
    maxWorkers: 4,
  },
});

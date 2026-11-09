import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/golden/**', 'tests/balance/**', '**/node_modules/**'],
    // whole-life tests take ~30 s on an idle machine and up to ~90 s while other runs load it: a timeout is not a failure of the game
    testTimeout: 180000,
    hookTimeout: 60000,
    // full-life tests keep a worker busy for many seconds; fewer workers in their own processes keep the worker RPC from timing out
    pool: 'forks',
    maxWorkers: 4,
    // one turn of the event loop after each test, so the worker RPC is answered between long synchronous tests (tests/setup/yield.ts)
    setupFiles: ['tests/setup/yield.ts'],
  },
});

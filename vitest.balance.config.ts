// Slow statistical targets (code-plan §10 "สมดุล"): npm run test:balance
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/balance/**/*.test.ts', 'tests/core/god.test.ts'], testTimeout: 600000, env: { SLOW_TESTS: '1' } } });

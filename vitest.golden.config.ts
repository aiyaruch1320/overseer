// Golden lives: npm run test:golden (UPDATE_GOLDEN=1 to write them again on purpose)
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/golden/**/*.test.ts'], testTimeout: 120000, setupFiles: ['tests/setup/yield.ts'] } });

// The balance run (vitest.balance.config.ts): a test there may play lives for ninety seconds without a break. The worker tells the runner a test started ("onTaskUpdate") and waits
// for the reply at most 60 s, a limit vitest does not let us set; a reply that arrives while the test runs is read only after it, too late, and the run ends with exit 1 though every
// test passed. Before each file's hooks and each test the worker waits a moment so the reply of the start lands first. One turn after each test as in tests/setup/yield.ts.
import { afterEach, beforeAll, beforeEach } from 'vitest';

/** Longer than the 100 ms vitest holds a task update back (@vitest/runner `sendTasksUpdateThrottled`), plus the reply on a busy machine; 168 tests make it under a minute in all. */
const SETTLE_MS = 250;

const settle = () => new Promise<void>((done) => setTimeout(() => setImmediate(done), SETTLE_MS));
// before the file's own beforeAll too: several play hundreds of lives there (bonds, bondage, combat, god-acts, items)
beforeAll(settle);
beforeEach(settle);
afterEach(() => new Promise<void>((done) => setImmediate(done)));

// Gives the worker's event loop one turn after each test. Many tests play whole lives synchronously; between two of them the runner only awaits
// microtasks, so the reply to the worker's "onTaskUpdate" call waits behind both. Two such tests in a row (35 s + 29 s in attention.test.ts)
// pass the 60 s RPC timeout and vitest ends with exit 1 though every test passed. One macrotask between tests lets the reply in.
import { afterEach } from 'vitest';

afterEach(() => new Promise<void>((done) => setImmediate(done)));

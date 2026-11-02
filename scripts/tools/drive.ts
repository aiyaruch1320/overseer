// The tools run a life as a generator that stops (yields) where something async may happen: at a death, where the end summary is asked for (scripts/tools/llm.ts).
// `runSync` drives it without stopping (no LLM: the same text as before, nothing awaited); `runAsync` awaits a hook at every stop. The core stays sync either way.
export function runSync<Y, R>(g: Generator<Y, R>): R {
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

export async function runAsync<Y, R>(g: Generator<Y, R>, onStop: (y: Y) => Promise<void>): Promise<R> {
  let r = g.next();
  while (!r.done) {
    await onStop(r.value);
    r = g.next();
  }
  return r.value;
}

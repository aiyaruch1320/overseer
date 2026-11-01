// Named seed streams (code-plan §6.2). One world seed splits into independent streams by name, so adding a
// system never shifts the draws of another. The generator is the one in scripts/sim/sim-world.mjs.
import type { RngState } from '../types';

/** Advances a mulberry32 state once; returns [next state, value in 0..1). */
function step(s: number): [number, number] {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

/** FNV-1a of the stream name, so the start of each stream depends only on its name and the world seed. */
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Streams that must start where the document-level simulators start. */
const SIM_STARTS: Record<string, (seed: number) => number> = {
  world: (seed) => seed >>> 0,
  'world.le': (seed) => (seed ^ 0x9e3779b9) >>> 0,
};

export function streamStart(seed: number, name: string): number {
  const f = SIM_STARTS[name];
  return f ? f(seed) : (seed ^ hashName(name)) >>> 0;
}

export interface Rng {
  /** Uniform in 0..1. */
  next(): number;
  /** Integer in min..max inclusive. */
  int(min: number, max: number): number;
  /** True with probability p (0..1). */
  chance(p: number): boolean;
  pick<T>(list: readonly T[]): T;
  /** Index chosen by weight; weights ≤ 0 never win. Returns −1 when all weights are ≤ 0. */
  weighted(weights: readonly number[]): number;
  /** Sum of six uniforms, centred and scaled like `gauss` in sim-world.mjs. */
  gauss(): number;
}

/** A stream bound to the state: every draw writes the new position back, so a save resumes exactly. */
export function stream(rng: RngState, seed: number, name: string): Rng {
  if (rng[name] === undefined) rng[name] = streamStart(seed, name);
  const next = () => {
    const [s, v] = step(rng[name]);
    rng[name] = s;
    return v;
  };
  return makeRng(next);
}

/** A stream that lives only in memory (tools, generators, tests). */
export function detached(seed: number): Rng {
  let s = seed >>> 0;
  return makeRng(() => {
    const [n, v] = step(s);
    s = n;
    return v;
  });
}

function makeRng(next: () => number): Rng {
  const r: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    weighted(weights) {
      let total = 0;
      for (const w of weights) if (w > 0) total += w;
      if (total <= 0) return -1;
      let x = next() * total;
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] <= 0) continue;
        x -= weights[i];
        if (x < 0) return i;
      }
      for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
      return -1;
    },
    gauss() {
      let u = 0;
      for (let i = 0; i < 6; i++) u += next();
      return (u - 3) / 0.7071;
    },
  };
  return r;
}

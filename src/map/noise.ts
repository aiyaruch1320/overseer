// Small seeded helpers of the map: a string hash, a mulberry32 stream and value noise. Pure, no DOM. The same inputs give the same map on every run
// (the map is drawn from data and a seed, never from Math.random).

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mixes numbers into one 32-bit hash (a seed from a country, a city and the map seed). */
export function mix(...n: number[]): number {
  let h = 0x9e3779b9;
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

export class Stream {
  private s: number;
  constructor(seed: number | string) {
    this.s = (typeof seed === 'number' ? seed : hashString(seed)) >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  float(a: number, b: number): number {
    return a + this.next() * (b - a);
  }
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
  /** Index by weight (weights <= 0 never win); -1 when all are. */
  weighted(w: readonly number[]): number {
    let total = 0;
    for (const x of w) if (x > 0) total += x;
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < w.length; i++) {
      if (w[i] <= 0) continue;
      r -= w[i];
      if (r < 0) return i;
    }
    return w.length - 1;
  }
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

export type Noise = (x: number, y: number, octaves?: number) => number;

/** Value noise in 0..1 with octaves (each one half as strong and twice as fine). */
export function makeNoise(seed: number): Noise {
  const r = new Stream(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = r.next();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const fade = (t: number) => t * t * (3 - 2 * t);
  const v = (x: number, y: number) => vals[perm[(perm[x & 255] + y) & 255]];
  const one = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, octaves = 4) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += one(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

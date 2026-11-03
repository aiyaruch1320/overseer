// Small tools of the scenery painter: colour, a seeded random, periodic noise (so a layer that moves wraps without a seam), a pixel canvas
// with a wrap-around x, ordered dithering, and the grade a season lays over the colours of a place. Pure: no DOM.
import type { Frame } from '../paint';

export type Rgb = [number, number, number];

export const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const h2 = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
export const toHex = ([r, g, b]: Rgb): string => `#${h2(r)}${h2(g)}${h2(b)}`;
export const col = (c: string | Rgb): Rgb => (typeof c === 'string' ? hex(c) : c);
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lum = (c: Rgb): number => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
export const dark = (c: Rgb, t: number): Rgb => mix(c, [12, 14, 28], t);
export const light = (c: Rgb, t: number): Rgb => mix(c, [255, 244, 214], t);
export const grey = (c: Rgb, t: number): Rgb => { const l = lum(c) * 255; return mix(c, [l, l, l], t); };
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (t: number): number => t * t * (3 - 2 * t);

/** mulberry32: the same seed gives the same run. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A string or number to a seed. */
export function seedOf(s: string | number): number {
  if (typeof s === 'number') return s >>> 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ── ordered dither ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number): number => B4[((y & 3) << 2) | (x & 3)];
/** A colour `t` (0..1) of the way from a to b, in steps of a quarter, the seam between the steps dithered. */
export function qmix(a: Rgb, b: Rgb, t: number, x: number, y: number): Rgb {
  const k = Math.min(1, Math.floor(clamp01(t) * 4 + bayer(x, y)) / 4);
  return k === 0 ? a : k === 1 ? b : mix(a, b, k);
}

// ── periodic noise ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** 1D value noise on a ring of `n` lattice points, smooth between them. */
class Ring {
  readonly v: Float32Array;
  constructor(seed: number, readonly n: number) {
    const r = rng(seed);
    this.v = Float32Array.from({ length: n }, () => r());
  }
  at(t: number): number {
    const i = Math.floor(t), f = smooth(t - i), n = this.n;
    const a = this.v[((i % n) + n) % n], b = this.v[(((i + 1) % n) + n) % n];
    return a + (b - a) * f;
  }
}
/** Fractal noise over `w` columns that repeats exactly at w: `cells` lattice points at the lowest octave. Returns 0..1 per column. */
export function fbm(w: number, seed: number, cells: number, oct = 3, gain = 0.5, ridged = false): Float32Array {
  const rings = Array.from({ length: oct }, (_, k) => new Ring(seed + k * 101, cells << k));
  const out = new Float32Array(w);
  let norm = 0, a = 1;
  for (let k = 0; k < oct; k++) { norm += a; a *= gain; }
  for (let x = 0; x < w; x++) {
    let s = 0;
    a = 1;
    for (let k = 0; k < oct; k++) {
      let n = rings[k].at((x / w) * (cells << k));
      if (ridged) n = 1 - Math.abs(2 * n - 1);
      s += n * a;
      a *= gain;
    }
    out[x] = s / norm;
  }
  return out;
}
/** The tops (y) of a ridge: `base` the lowest, `amp` the rise. Repeats at w. */
export function ridgeTops(w: number, base: number, amp: number, seed: number, cells = 5, oct = 3, gain = 0.5, ridged = false): Int16Array {
  const n = fbm(w, seed, cells, oct, gain, ridged);
  return Int16Array.from(n, (v) => Math.round(base - amp * v));
}

// ── the pixel canvas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export class Pix {
  readonly data: Uint8ClampedArray<ArrayBuffer>;
  constructor(readonly w: number, readonly h: number, readonly wrap = false, from?: Frame) {
    this.data = new Uint8ClampedArray(w * h * 4);
    if (from) this.data.set(from.data);
  }
  set(x: number, y: number, c: Rgb, a = 255): void {
    if (x !== (x | 0)) x = Math.round(x);
    if (y !== (y | 0)) y = Math.round(y);
    if (y < 0 || y >= this.h) return;
    if (this.wrap) x = ((x % this.w) + this.w) % this.w;
    else if (x < 0 || x >= this.w) return;
    const i = (y * this.w + x) * 4, d = this.data;
    if (a >= 255) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
    const under = d[i + 3] / 255, k = a / 255, res = k + under * (1 - k);
    for (let q = 0; q < 3; q++) d[i + q] = (c[q] * k + d[i + q] * under * (1 - k)) / (res || 1);
    d[i + 3] = res * 255;
  }
  get(x: number, y: number): Rgb | null {
    if (this.wrap) x = ((x % this.w) + this.w) % this.w;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.data[i + 3] ? [this.data[i], this.data[i + 1], this.data[i + 2]] : null;
  }
  rect(x: number, y: number, w: number, h: number, c: Rgb, a = 255): void { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  fill(c: Rgb): void { this.rect(0, 0, this.w, this.h, c); }
  disc(cx: number, cy: number, r: number, c: Rgb, a = 255): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, a);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Rgb, a = 255): void {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
  }
  /** Lay a finished sprite (its top left at x, y), optionally pulled toward a fog colour (the far layers lose contrast). */
  blit(f: Frame, x: number, y: number, fog?: Rgb, amt = 0, flip = false): void {
    for (let j = 0; j < f.h; j++)
      for (let i = 0; i < f.w; i++) {
        const o = (j * f.w + (flip ? f.w - 1 - i : i)) * 4;
        const a = f.data[o + 3];
        if (!a) continue;
        let c: Rgb = [f.data[o], f.data[o + 1], f.data[o + 2]];
        if (fog && amt) c = qmix(c, fog, amt, x + i, y + j);
        this.set(x + i, y + j, c, a);
      }
  }
  frame(): Frame { return { w: this.w, h: this.h, data: this.data }; }
}

// ── the grade of a season ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Role = 'sky' | 'foliage' | 'ground' | 'rock' | 'man';

/**
 * The tint a season (0 sowing, 1 rains, 2 harvest, 3 winter) lays over a colour by what the colour is. `snow` is how much of the winter a
 * continent keeps as snow (a desert keeps little, a lava land none). With no season the colours pass through.
 */
export class Grade {
  constructor(readonly season: number | undefined, readonly snow: number) {}
  /** 0 outside winter. */
  get snowAmt(): number { return this.season === 3 ? this.snow : 0; }
  get rain(): boolean { return this.season === 1; }
  private readonly memo: Record<Role, Map<string, Rgb>> = { sky: new Map(), foliage: new Map(), ground: new Map(), rock: new Map(), man: new Map() };
  /** Shared result: callers must not change the array. */
  c(color: string | Rgb, role: Role): Rgb {
    if (typeof color !== 'string') return this.grade(color, role);
    const m = this.memo[role];
    let r = m.get(color);
    if (!r) { r = this.grade(hex(color), role); m.set(color, r); }
    return r;
  }
  private grade(color: Rgb, role: Role): Rgb {
    let c = color;
    switch (this.season) {
      case 0:
        if (role === 'foliage') c = mix(c, [138, 208, 106], 0.14);
        else if (role === 'sky') c = light(c, 0.04);
        else if (role === 'ground') c = mix(c, [120, 170, 90], 0.06);
        break;
      case 1:
        if (role === 'sky') c = grey(mix(c, [84, 98, 112], 0.34), 0.25);
        else c = dark(grey(c, 0.14), 0.1);
        break;
      case 2:
        if (role === 'foliage') c = mix(c, [200, 150, 54], 0.4);
        else if (role === 'ground') c = mix(c, [190, 150, 90], 0.12);
        else if (role === 'sky') c = mix(c, [240, 196, 140], 0.1);
        break;
      case 3:
        if (role === 'sky') c = mix(c, [168, 184, 208], 0.3);
        else if (role === 'foliage') c = dark(mix(c, [130, 150, 146], 0.38), 0.06);
        else if (role === 'man') c = mix(c, [150, 166, 192], 0.07);
        else c = mix(c, [170, 186, 210], 0.1);
        break;
    }
    return c;
  }
  /** Winter snow over a ground colour at a pixel (dithered cover). */
  snowOn(c: Rgb, x: number, y: number, cover = 1): Rgb {
    const s = this.snowAmt * cover;
    return s > 0 && bayer(x, y) < s * 0.85 ? mix([226, 234, 244], c, 0.12) : c;
  }
}

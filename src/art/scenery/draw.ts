// Shared brushes of the scenery painter: a shaded ridge, a dithered sky, cloud puffs, halos, smoke, and the textured ground strip.
import { GROUND_Y, SCENE_H, SCENE_W } from './types';
import { bayer, clamp01, dark, fbm, light, mix, qmix, rng, type Pix, type Rgb } from './util';

export interface RidgeOpts {
  body: Rgb;
  lit: Rgb;
  shade: Rgb;
  /** The colour the ridge fades to toward the bottom and by distance (the horizon haze). */
  fog?: Rgb;
  /** How strong the fog is at the bottom of the layer, 0..1 (and a quarter of that at the crest). */
  fogAmt?: number;
  /** Winter snow on the crests, 0..1. */
  snow?: number;
  /** Where the fog begins to thicken (default the crest of the lowest point). */
  fogFrom?: number;
  /** Dither strength of the surface texture. */
  grain?: number;
  /** Rows from here down are hidden under the ground layer and not painted (default 152). */
  floor?: number;
}

/** Fill the columns of a ridge down to the bottom: the lit flank (rising toward the right) gets a light crest, the other flank a shade crest. */
export function fillRidge(px: Pix, tops: ArrayLike<number>, o: RidgeOpts): void {
  const w = px.w, H = Math.min(px.h, o.floor ?? 152);
  const fogFrom = o.fogFrom ?? 0, fogAmt = o.fogAmt ?? 0, snowC: Rgb = o.snow ? mix(o.lit, [236, 242, 250], o.snow) : o.lit;
  // the four colours at the five steps of fog, so the loop below only looks them up
  const lut = (c: Rgb): Rgb[] => (o.fog && fogAmt ? [0, 1, 2, 3, 4].map((k) => (k === 0 ? c : mix(c, o.fog!, k / 4))) : [c]);
  const L = { body: lut(o.body), lit: lut(o.lit), shade: lut(o.shade), snow: lut(snowC) };
  const pick = (t: Rgb[], f: number, x: number, y: number): Rgb => (t.length === 1 ? t[0] : t[Math.min(4, Math.floor(clamp01(f) * 4 + bayer(x, y)))]);
  for (let x = 0; x < w; x++) {
    const top = tops[x], s = tops[(x - 1 + w) % w] - tops[(x + 1) % w];
    const litRows = s > 0 ? 2 + Math.min(5, s * 1.2) : 0, shRows = s < 0 ? 3 + Math.min(6, -s * 1.4) : 0;
    for (let y = Math.max(0, top); y < H; y++) {
      const d = y - top;
      let t = L.body;
      if (d === 0) t = o.snow && s > -2 ? L.snow : L.lit;
      else if (d < litRows) t = d < litRows - 1 || bayer(x, y) < 0.5 ? L.lit : L.body;
      else if (d < shRows) t = d < shRows - 1 || bayer(x, y) < 0.5 ? L.shade : L.body;
      else if (o.grain && bayer(x + 2, y) < o.grain * (0.4 + 0.6 * clamp01(d / 30))) t = L.shade;
      if (o.snow && d > 0 && d < 3 && s >= 0 && bayer(x, y) < o.snow * 0.8) t = L.snow;
      px.set(x, y, pick(t, clamp01((y - fogFrom) / Math.max(1, px.h - fogFrom)) * fogAmt + fogAmt * 0.25, x, y));
    }
  }
}

/** A sky of dithered bands: `stops` run from the zenith to the horizon, which sits at `horizon` (rows); below it the last stop continues. */
export function paintGradient(px: Pix, stops: Rgb[], horizon = 128): void {
  const n = stops.length - 1;
  for (let y = 0; y < px.h; y++)
    for (let x = 0; x < px.w; x++) {
      const t = clamp01(y / horizon) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
      px.set(x, y, f > bayer(x, y) ? stops[i + 1] : stops[i]);
    }
}

/** A dithered halo around a point: the glow of a sun, a fire, a lamp. */
export function halo(px: Pix, cx: number, cy: number, r: number, c: Rgb, strength = 1): void {
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(px.h - 1, Math.ceil(cy + r));
  const x0 = px.wrap ? Math.floor(cx - r) : Math.max(0, Math.floor(cx - r)), x1 = px.wrap ? Math.ceil(cx + r) : Math.min(px.w - 1, Math.ceil(cx + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const b = bayer(x, y), reach = 1 - (1 - b) / (3 * strength);
      if (reach <= 0 || d2 >= reach * reach * r2) continue;
      const k = Math.floor((1 - Math.sqrt(d2) / r) * 3 * strength + b) / 3;
      if (k > 0) px.set(x, y, c, Math.min(255, k * 150));
    }
}

/** A cloud: a union of discs, light on top, shaded under, with a dithered seam between. */
export function cloud(px: Pix, cx: number, cy: number, w: number, h: number, hi: Rgb, base: Rgb, lo: Rgb, seed: number, a = 255): void {
  const r = rng(seed), blobs: [number, number, number][] = [];
  const n = 3 + Math.round(w / 22);
  for (let i = 0; i < n; i++) blobs.push([cx + (r() - 0.5) * w * 0.8, cy + (r() - 0.35) * h * 0.4, h * (0.28 + r() * 0.3)]);
  blobs.push([cx, cy + h * 0.1, h * 0.36]);
  const x0 = Math.floor(cx - w / 2 - h), x1 = Math.ceil(cx + w / 2 + h), y0 = Math.floor(cy - h), y1 = Math.ceil(cy + h * 0.6);
  const mw = x1 - x0 + 1, mh = y1 - y0 + 1, top = new Float32Array(mw * mh).fill(Infinity);
  for (const [bx, by, br] of blobs)
    for (let y = Math.max(y0, Math.floor(by - br)); y <= Math.min(y1, Math.ceil(by + br)); y++)
      for (let x = Math.max(x0, Math.floor(bx - br)); x <= Math.min(x1, Math.ceil(bx + br)); x++)
        if ((x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= br * br) { const i = (y - y0) * mw + x - x0; if (by - br < top[i]) top[i] = by - br; }
  for (let y = y0; y <= y1; y++) {
    if (y > cy + h * 0.28) break;
    for (let x = x0; x <= x1; x++) {
      const t = top[(y - y0) * mw + x - x0];
      if (t === Infinity) continue;
      const depth = (y - t) / (h * 0.7);
      px.set(x, y, depth < 0.18 ? hi : depth < 0.5 + (bayer(x, y) - 0.5) * 0.25 ? base : lo, a);
    }
  }
}

/** Smoke rising from a point: a chain of puffs that widen and thin as they climb and lean with the wind. */
export function smoke(px: Pix, x: number, y: number, rise: number, c: Rgb, lit: Rgb, lean = 0.3, seed = 1): void {
  const r = rng(seed);
  for (let i = 0; i < rise; i += 3) {
    const t = i / rise, rad = 1.4 + t * 5 + r() * 1.2, cx = x + i * lean + Math.sin(i * 0.3 + seed) * 2;
    for (let yy = -Math.ceil(rad); yy <= rad; yy++)
      for (let xx = -Math.ceil(rad); xx <= rad; xx++) {
        if (xx * xx + yy * yy > rad * rad || bayer(Math.round(cx) + xx, Math.round(y - i) + yy) > 1 - t * 0.7) continue;
        px.set(cx + xx, y - i + yy, xx + yy < -rad * 0.3 ? lit : c, 230);
      }
  }
}

/** Deterministic pixel hash 0..1. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface GroundOpts {
  y0?: number;
  base: Rgb;
  shade: Rgb;
  lit: Rgb;
  /** Sprinkled single pixels. */
  specks?: Rgb[];
  /** Share of the area the specks cover. */
  speckDens?: number;
  /** A trodden path band under the characters' feet. */
  path?: { y: number; h: number; base: Rgb; shade: Rgb; edge?: Rgb };
  /** Grass blades or tufts standing on the back edge (the colour of the tufts). */
  tufts?: Rgb;
  /** Far strip (the back of the ground, lighter by distance), rows. */
  haze?: Rgb;
  /** The ground's bottom darkening. */
  vignette?: number;
  /** A tint snow lays on it. */
  snow?: number;
  seed: number;
}

/** The strip of ground the characters stand on: noise-banded tones, specks, a path, tufts on the back edge. */
export function paintGround(px: Pix, o: GroundOpts): void {
  const y0 = o.y0 ?? GROUND_Y - 6, w = px.w, H = px.h;
  const wob = fbm(w, o.seed, Math.max(4, w >> 5), 3, 0.5);
  const white: Rgb = [232, 238, 246];
  for (let y = y0; y < H; y++) {
    const dy = (y - y0) / (H - y0);
    for (let x = 0; x < w; x++) {
      let c = o.base;
      const n = wob[x] * 0.7 + hash2(x >> 2, y >> 1, o.seed) * 0.3;
      if (n > 0.64 + dy * 0.1) c = bayer(x, y) < 0.7 ? o.lit : o.base;
      else if (n < 0.36 - dy * 0.05) c = bayer(x + 1, y) < 0.7 ? o.shade : o.base;
      if (o.haze && y - y0 < 7) c = qmix(c, o.haze, (1 - (y - y0) / 7) * 0.7, x, y);
      if (y === y0) c = o.lit;
      if (o.specks && hash2(x, y, o.seed + 7) < (o.speckDens ?? 0.05)) c = o.specks[Math.floor(hash2(x, y, o.seed + 9) * o.specks.length)];
      if (o.vignette) c = qmix(c, dark(c, 0.5), dy * o.vignette, x, y);
      px.set(x, y, c);
    }
  }
  if (o.path) {
    const p = o.path;
    for (let y = p.y; y < p.y + p.h; y++)
      for (let x = 0; x < w; x++) {
        const edge = y === p.y || y === p.y + p.h - 1;
        const wobble = Math.round((wob[x] - 0.5) * 3);
        const yy = y + wobble;
        let c = hash2(x, y, o.seed + 3) < 0.12 ? p.shade : p.base;
        if (edge && p.edge) c = p.edge;
        px.set(x, yy, c);
      }
  }
  if (o.tufts) {
    for (let x = 0; x < w; x++)
      if (hash2(x, 0, o.seed + 21) < 0.18) {
        const hgt = 1 + Math.floor(hash2(x, 1, o.seed + 22) * 3);
        for (let k = 1; k <= hgt; k++) px.set(x, y0 - k, k === hgt ? light(o.tufts, 0.15) : o.tufts);
      }
  }
  if (o.snow) {
    for (let y = y0; y < H; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < o.snow * 0.85 && wob[x] > 0.3) px.set(x, y, white);
  }
}

/** A dither of snow over rows y0..y1 of a layer (winter). */
export function snowDust(px: Pix, y0: number, y1: number, amt: number): void {
  if (amt <= 0) return;
  for (let y = y0; y < y1; y++) for (let x = 0; x < px.w; x++) if (bayer(x, y) < amt * 0.5 && hash2(x >> 1, y >> 1, 77) < 0.8) px.set(x, y, [230, 238, 248]);
}

export const HORIZON = 128;
export { GROUND_Y, SCENE_H, SCENE_W };

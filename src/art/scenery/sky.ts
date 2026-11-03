// The sky layer: the dithered gradient of the continent plus what hangs in it (sun, clouds, stars, fog bands, light shafts, a canopy). 320 × 180, still.
import type { Ctx } from './ctx';
import { H, W } from './ctx';
import { cloud, halo, paintGradient } from './draw';
import { bayer, dark, hex, light, mix, Pix, rng, type Rgb } from './util';

export function skyBase(cx: Ctx, horizon = 132): Pix {
  const px = new Pix(W, H);
  paintGradient(px, cx.P.sky.map((h) => cx.g.c(h, 'sky')), horizon);
  return px;
}

export interface CloudSet { n: number; y: [number, number]; w: [number, number]; h: [number, number]; hi: string; base: string; lo: string }
export function scatterClouds(cx: Ctx, px: Pix, s: CloudSet, salt: number): void {
  const r = rng(cx.seed * 31 + salt);
  const hi = cx.g.c(s.hi, 'sky'), base = cx.g.c(s.base, 'sky'), lo = cx.g.c(s.lo, 'sky');
  for (let i = 0; i < s.n; i++) {
    const t = (i + r() * 0.8) / s.n;
    cloud(px, -10 + t * (W + 20), s.y[0] + r() * (s.y[1] - s.y[0]), s.w[0] + r() * (s.w[1] - s.w[0]), s.h[0] + r() * (s.h[1] - s.h[0]), hi, base, lo, Math.floor(r() * 1e6));
  }
}

export function sun(cx: Ctx, px: Pix, x: number, y: number, r: number, core: string, glow: string, strength = 1): void {
  halo(px, x, y, r * 4.5, cx.g.c(glow, 'sky'), strength);
  px.disc(x, y, r, cx.g.c(core, 'sky'));
  px.disc(x - r * 0.25, y - r * 0.25, r * 0.55, light(cx.g.c(core, 'sky'), 0.4));
}

export function stars(cx: Ctx, px: Pix, n: number, yMax: number, salt: number, c = '#e8e6f4'): void {
  const r = rng(cx.seed * 17 + salt), col = hex(c);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * r() * yMax);
    px.set(x, y, col, 120 + Math.floor(r() * 135));
    if (r() < 0.12) { px.set(x + 1, y, col, 90); px.set(x - 1, y, col, 90); px.set(x, y + 1, col, 90); px.set(x, y - 1, col, 90); }
  }
}

/** Slanted shafts of light (the forest), each dithered across its width. */
export function shafts(cx: Ctx, px: Pix, c: Rgb, n: number, salt: number, slope = 0.5, strength = 0.2): void {
  const r = rng(cx.seed * 13 + salt);
  for (let i = 0; i < n; i++) {
    const x0 = -40 + r() * (W + 60), wd = 9 + r() * 20, a = strength * (0.6 + r() * 0.8);
    for (let y = 0; y < H; y++) {
      const xs = x0 + y * slope, grow = 1 + y / H * 0.6, fade = 1 - y / (H * 1.05);
      for (let x = Math.round(xs); x < xs + wd * grow; x++) {
        const edge = Math.min(x - xs, xs + wd * grow - x) / (wd * grow * 0.5);
        if (bayer(x, y) < a * Math.min(1, edge * 1.6) * fade * 3) px.set(x, y, c, 70);
      }
    }
  }
}

/** Flat soft bands of fog (the misty lands): a dithered strip of a pale colour. */
export function fogBands(cx: Ctx, px: Pix, c: Rgb, ys: number[], thick: number, amt = 0.5, salt = 3): void {
  const r = rng(cx.seed * 19 + salt);
  for (const y0 of ys) {
    const ph = r() * 6.28, amp = 3 + r() * 4, cyc = Math.max(1, Math.round(px.w / 170));
    for (let x = 0; x < px.w; x++) {
      const yc = y0 + Math.sin((x / px.w) * Math.PI * 2 * cyc + ph) * amp;
      for (let k = -thick; k <= thick; k++) {
        const t = 1 - Math.abs(k) / thick;
        if (bayer(x, Math.round(yc) + k) < t * amt) px.set(x, Math.round(yc) + k, c, 110);
      }
    }
  }
}

/** The leaf canopy of the forest hanging over the top of the sky. */
export function canopy(cx: Ctx, px: Pix, leaves: Rgb[], depth: number, salt: number): void {
  const r = rng(cx.seed * 23 + salt);
  const bottoms = new Float32Array(W);
  const lobes = Array.from({ length: 9 }, () => ({ x: r() * W, w: 20 + r() * 36, d: 0.4 + r() * 0.8 }));
  for (let x = 0; x < W; x++) {
    let b = depth * 0.45;
    for (const l of lobes) { const u = Math.abs(x - l.x) / l.w; if (u < 1) b = Math.max(b, depth * l.d * (1 - u * u)); }
    bottoms[x] = b + Math.sin(x * 0.7) * 1.5 + (r() - 0.5) * 3;
  }
  for (let x = 0; x < W; x++)
    for (let y = 0; y < bottoms[x]; y++) {
      const d = bottoms[x] - y;
      let k = d < 2 ? 3 : d < 5 ? (bayer(x, y) < 0.5 ? 3 : 2) : d < 12 ? 2 : 1;
      if (y > 3 && bayer(x + 1, y) < 0.1) k = Math.min(3, k + 1);
      if (d > 3 && r() < 0.012) { px.set(x, y, mix(leaves[3], [255, 250, 200], 0.4)); continue; }
      px.set(x, y, k === 0 ? leaves[0] : leaves[Math.min(leaves.length - 1, k)]);
    }
  // a few leaf clumps hanging below
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * W), len = 3 + Math.floor(r() * 9);
    for (let k = 0; k < len; k++) px.set(x + (k % 2), bottoms[x] + k, leaves[1]);
    px.set(x, bottoms[x] + len, leaves[3]);
  }
}

export const dim = (c: Rgb, t: number): Rgb => dark(c, t);

// What every painter of a layer is handed: the continent's profile, the season's grade, a seeded random, and a cache of sprites so the same
// tree or house is drawn once per painting.
import type { Frame } from '../paint';
import type { CountryScenery } from './countries';
import type { Profile } from './profiles';
import { SCENE_H, SCENE_W, type Setting } from './types';
import { bayer, rng, type Grade, type Pix, type Rgb } from './util';

export const W = SCENE_W;
export const H = SCENE_H;
/** The widths of the layers that move (all repeat at their own width, so a camera may wrap them). */
export const FAR_W = 640;
export const MID_W = 960;
export const GND_W = 1280;
/** The top of the ground the characters stand on (the contract's GROUND_Y minus the depth of the far edge). */
export const GY = 144;

export interface Ctx {
  P: Profile;
  g: Grade;
  setting: Setting;
  country?: CountryScenery;
  /** The variation seed of the place: layouts shift with it, the look of the continent does not. */
  seed: number;
  /** A random run fresh for each call of `rand(salt)`; the same seed and salt give the same run. */
  rand: (salt: number) => () => number;
  /** The horizon haze colour (graded). */
  fog: Rgb;
  spr: (key: string, make: () => Frame) => Frame;
}

export function makeCtx(P: Profile, g: Grade, setting: Setting, country: CountryScenery | undefined, seed: number): Ctx {
  const cache = new Map<string, Frame>();
  return {
    P, g, setting, country, seed,
    rand: (salt) => rng((seed * 7919 + salt * 104729 + P.base.charCodeAt(0) * 31 + P.base.charCodeAt(1)) >>> 0),
    fog: g.c(P.sky[P.sky.length - 1], 'sky'),
    spr: (key, make) => {
      let f = cache.get(key);
      if (!f) { f = make(); cache.set(key, f); }
      return f;
    },
  };
}

/** Lay a sprite standing on `baseY`, centred on x. */
export function place(px: Pix, f: Frame, x: number, baseY: number, fog?: Rgb, amt = 0, flip = false): void {
  px.blit(f, Math.round(x - f.w / 2), Math.round(baseY - f.h), fog, amt, flip);
}

export interface IslandOpts { grass: Rgb; rock: Rgb; rockLit: Rgb; rockShade: Rgb; fog?: Rgb; fogAmt?: number; glow?: Rgb; roots?: Rgb; seed: number }
/** A floating island: a flat grassy top and a rough cone of rock hanging under it with roots and a pale glowing stone. */
export function island(px: Pix, cx: number, cy: number, hw: number, depth: number, o: IslandOpts): void {
  const r = rng(o.seed);
  const jag = Array.from({ length: Math.ceil(hw * 2) + 2 }, () => 0.78 + r() * 0.22);
  const fogAmt = o.fogAmt ?? 0;
  const tint = (c: Rgb, x: number, y: number): Rgb => (o.fog && fogAmt ? mixq(c, o.fog, fogAmt, x, y) : c);
  for (let dx = -hw; dx <= hw; dx++) {
    const u = dx / hw, x = Math.round(cx + dx);
    const d = depth * (1 - Math.abs(u) ** 1.7) * jag[Math.round(dx + hw)];
    const topY = cy + (Math.abs(u) > 0.92 ? 1 : 0);
    for (let k = 0; k <= d; k++) {
      const y = topY + k;
      let c: Rgb;
      if (k < 2) c = k === 0 && u < 0.2 ? lit(o.grass) : o.grass;
      else if (u < -0.35 && k < 5) c = o.rockLit;
      else c = bayer(x, y) < 0.18 + ((u + 1) / 2) * 0.45 + (k / Math.max(1, d)) * 0.35 ? o.rockShade : o.rock;
      px.set(x, y, tint(c, x, y));
    }
  }
  const rc = o.roots ?? o.rockShade;
  for (let i = 0; i < Math.round(hw / 7); i++) {
    const dx = Math.round((r() * 1.6 - 0.8) * hw), u = dx / hw, d = depth * (1 - Math.abs(u) ** 1.7) * 0.8;
    const len = 5 + Math.round(r() * 11);
    for (let k = 0; k < len; k++) px.set(cx + dx + Math.round(Math.sin(k * 0.6 + i) * 0.8), cy + d + k, tint(rc, cx + dx, cy + d + k), k > len - 3 ? 140 : 255);
  }
  if (o.glow) { const gx = Math.round(cx + (r() - 0.5) * hw * 0.6), gy = Math.round(cy + depth * 0.45); px.set(gx, gy, o.glow); px.set(gx + 1, gy, o.glow); px.set(gx, gy + 1, o.glow, 160); }
}
const lit = (c: Rgb): Rgb => [Math.min(255, c[0] + 26), Math.min(255, c[1] + 26), Math.min(255, c[2] + 18)];
const mixq = (a: Rgb, b: Rgb, t: number, x: number, y: number): Rgb => {
  const k = Math.min(1, Math.floor(t * 4 + bayer(x, y)) / 4);
  return k === 0 ? a : [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

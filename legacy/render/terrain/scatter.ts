// Scatters map symbols over the land by biome. Placement is a pure function of (tier, cell), cached per cell, so the same
// tree is always in the same place; finer tiers take over as you zoom in, which keeps detail density constant on screen.
import { CONT, DEFS } from '../../world/geo';
import { zoneOf, smooth, type Probe } from './fields';
import * as G from './glyphs';
import type { ViewRect } from './coast';
import { VARIANTS } from './sprites';

export interface Placed { x: number; y: number; u: number; r: number; v: number; q: number; fn: G.GlyphFn; tier: number }

export const TIERS = 8;
const BASE = 40; // MU: cell size of tier 0; each tier halves it
export const cellSize = (t: number) => BASE / 2 ** t;

const PEAK_ROCK = G.peak('rock', false), PEAK_SNOW = G.peak('rock', true), PEAK_DARK = G.peak('dark', false);

function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const rnd = (h: number, k: number) => (((Math.imul(h, 2654435761 + k * 40503) >>> 8) ^ (h >>> 3)) & 0xffff) / 65536;

type Pick = [G.GlyphFn, number] | null;

function rule(def: number, x: number, y: number, e: number, inl: number, t: number, r1: number, r2: number): Pick {
  const d = DEFS[def];
  const z = (k: Parameters<typeof zoneOf>[1]) => zoneOf(d, k, x, y);
  switch (d.cont) {
    case CONT.aldria: {
      const hi = z('highland'), fo = z('forest'), fa = z('farm');
      if (e > 0.7 && t <= 3) return [e > 0.86 ? PEAK_SNOW : PEAK_ROCK, 1.1];
      if (hi > 0.3 && r2 < 0.5 * hi + 0.15) return [G.hills, 1.05];
      if (fo > 0.2 && r2 < 0.3 + 0.55 * fo) return [r1 < 0.28 ? G.pine : G.oak, 0.95];
      if (fa > 0.2 && t >= 1 && r2 < 0.6 * fa) return t >= 3 && r1 < 0.2 ? [G.hut, 0.8] : [G.field, 1.0];
      if (t >= 2 && r2 < 0.2) return [G.oak, 0.85];
      if (t >= 3 && r2 < 0.45) return [G.tuft, 0.7];
      return null;
    }
    case CONT.silvanel: {
      const tree = z('tree'), sw = z('swamp'), hi = z('highland');
      if (sw > 0.3 && r2 < 0.65) return t >= 3 && r1 < 0.5 ? [G.reed, 0.8] : [G.jungle, 0.9];
      if (hi > 0.4 && r2 < 0.5) return [PEAK_ROCK, 1.0];
      if (r2 < 0.7) {
        // each stretch of forest has its own character (a hash of the 120 MU patch it lies in): one is mostly ferns, another bamboo, another pines,
        // so the continent reads as many woods and not one round bush repeated
        const kind = hash3(Math.floor(x / 120), Math.floor(y / 120), 7) % 5, v = r1;
        const mixes: G.GlyphFn[][] = [[G.jungle, G.fern, G.pine, G.broadleaf], [G.jungle, G.bamboo, G.palm, G.fern], [G.pine, G.jungle, G.fern, G.willow], [G.broadleaf, G.palm, G.jungle, G.bamboo], [G.willow, G.jungle, G.fern, G.pine]];
        const m = mixes[kind];
        return [v < 0.4 ? m[0] : v < 0.65 ? m[1] : v < 0.85 ? m[2] : m[3], tree > 0.4 ? 1.5 : 1.2];
      }
      if (t >= 3) return [G.tuft, 0.7];
      return null;
    }
    case CONT.nebulia: {
      const sw = z('swamp'), pit = z('pit');
      if (pit > 0.3) return null;
      if (sw > 0.3 && r2 < 0.5) return t >= 3 ? [G.reed, 0.8] : [G.deadtree, 0.9];
      if (r2 < 0.3) return [G.mistcurl, 1.25];
      if (r2 < 0.46 && t >= 1) return [G.deadtree, 0.95];
      if (t >= 3 && r2 < 0.5 && r1 < 0.12) return [G.lamp, 0.8];
      return null;
    }
    case CONT.mecharia: {
      const city = z('city'), farm = z('farm'), ruin = z('ruin'), hi = z('highland');
      if (ruin > 0.35 && r2 < 0.55) return r1 < 0.5 ? [G.ruin, 0.9] : [G.boulder, 0.8];
      if (city > 0.3 && t >= 1 && r2 < 0.5 * city + 0.1) return r1 > 0.75 ? [G.gear, 1.7] : [G.factory, 1.0];
      if (farm > 0.3 && t >= 1 && r2 < 0.6 * farm) return [G.field, 1.0];
      if (hi > 0.3 && r2 < 0.45) return [PEAK_ROCK, 1.0];
      if (r2 < 0.16) return [G.boulder, 0.7];
      if (t >= 3 && r2 < 0.38) return [G.tuft, 0.7];
      return null;
    }
    case CONT.saharan: {
      const mt = z('mountain'), dn = z('dune'), oa = z('oasis'), hi = z('highland');
      if (oa > 0.3 && r2 < 0.85) return [G.palm, 0.95];
      if ((e > 0.55 || mt > 0.35) && r2 < 0.82) return t <= 3 ? [e > 0.8 ? PEAK_SNOW : PEAK_ROCK, 1.25] : [G.boulder, 0.8];
      if (hi > 0.3 && r2 < 0.4) return [G.mesa, 1.0];
      if (r2 < 0.2 + 0.5 * dn) return [G.dune, 1.15];
      if (t >= 3 && r2 < 0.5) return [G.boulder, 0.55];
      return null;
    }
    case CONT.kazdurum: {
      const lv = z('lava'), cr = z('crater'), ash = z('ash'), hi = z('highland'), pit = z('pit');
      if (pit > 0.3) return null;
      if (cr > 0.25 && r2 < 0.55 && t <= 3) return [G.volcano, 1.5];
      if (lv > 0.3) return r2 < 0.3 && t >= 2 ? [G.lavapool, 0.9] : r2 < 0.62 && t <= 3 ? [G.volcano, 1.05] : null;
      if (hi > 0.3 && r2 < 0.5) return [PEAK_DARK, 1.0];
      if (ash > 0.3 && r2 < 0.35) return [G.ashheap, 1.0];
      if (r2 < 0.2) return [PEAK_DARK, 0.7];
      if (t >= 3 && r2 < 0.4) return [G.crack, 0.8];
      return null;
    }
    case CONT.morhaven: {
      const bad = z('badland'), ash = z('ash'), lv = z('lava');
      if (lv > 0.3 && r2 < 0.4) return t >= 2 ? [G.lavapool, 0.9] : [G.volcano, 1.0];
      if (ash > 0.3 && r2 < 0.35) return [G.ashheap, 1.0];
      if (r2 < 0.1 + 0.3 * bad) return [G.spire, 1.1];
      if (t >= 2 && r2 < 0.2 && r1 < 0.4) return [G.tent, 0.85];
      if (r2 < 0.36) return r1 < 0.5 ? [G.deadtree, 0.9] : [G.boulder, 0.7];
      if (t >= 2 && r2 < 0.55) return [G.crack, 1.1];
      return null;
    }
    case CONT.nerea: {
      const city = z('city');
      if (inl < 2.5) return null;
      if (city > 0.3 && t >= 2 && r2 < 0.4) return [G.hut, 0.8];
      if (r2 < 0.55) return r1 < 0.65 ? [G.palm, 1.05] : [G.oak, 0.9];
      if (t >= 3) return [G.tuft, 0.7];
      return null;
    }
    default: { // azgar (top surface)
      const city = z('city'), mt = z('mountain'), farm = z('farm'), lv = z('lava'), ruin = z('ruin');
      if (city > 0.3 && t >= 1 && t <= 3 && r2 < 0.45) return [G.tower, 1.3];
      if (ruin > 0.3 && r2 < 0.5) return [G.ruin, 0.9];
      if (mt > 0.3 && r2 < 0.6) return [PEAK_SNOW, 1.1];
      if (lv > 0.3 && r2 < 0.5) return [G.volcano, 1.0];
      if (farm > 0.3 && r2 < 0.55) return [G.cloudfarm, 1.0];
      if (r2 < 0.42) return [r1 < 0.7 ? G.oak : G.pine, 0.9];
      if (t >= 3) return [G.tuft, 0.7];
      return null;
    }
  }
}

export class Scatter {
  private cache = new Map<number, Placed[]>();
  /** return true where something else owns the ground (a town's built-up area): no trees or fields are scattered there */
  exclude: ((x: number, y: number) => boolean) | null = null;
  constructor(private probe: (x: number, y: number) => Probe, private mode: 'land' | 'sky' | 'sea' = 'land') {}

  clear() { this.cache.clear(); }

  private cell(t: number, cx: number, cy: number): Placed[] {
    const key = ((t * 4096 + (cx + 100)) * 4096 + (cy + 100));
    const hit = this.cache.get(key);
    if (hit) return hit;
    const out: Placed[] = [];
    const cs = cellSize(t);
    const h = hash3(cx, cy, t + 1);
    const x = (cx + 0.12 + 0.76 * rnd(h, 1)) * cs, y = (cy + 0.12 + 0.76 * rnd(h, 2)) * cs;
    const p = this.probe(x, y);
    if (this.mode === 'sea') {
      // open water only, well clear of any coast: wave marks everywhere, now and then a ship
      if (!p.land && p.sea > 12 && t >= 1) {
        const r = rnd(h, 5), pick = rnd(h, 3);
        if (pick < 0.02 && p.sea > 30 && t >= 2 && t <= 4) out.push({ x, y, u: cs * 1.1, r, v: Math.min(VARIANTS - 1, Math.floor(r * VARIANTS)), q: rnd(h, 6), fn: G.ship, tier: t });
        else if (pick < 0.42) out.push({ x, y, u: cs * 0.95, r, v: Math.min(VARIANTS - 1, Math.floor(r * VARIANTS)), q: rnd(h, 6), fn: G.wave, tier: t });
      }
    } else if (p.land && p.def >= 0 && !!DEFS[p.def].float === (this.mode === 'sky') && p.inland > cs * 0.32) {
      const pk = this.exclude && this.exclude(x, y) ? null : rule(p.def, x, y, p.elev, p.inland, t, rnd(h, 3), rnd(h, 4));
      if (pk) { const r = rnd(h, 5); out.push({ x, y, u: cs * pk[1], r, v: Math.min(VARIANTS - 1, Math.floor(r * VARIANTS)), q: rnd(h, 6), fn: pk[0], tier: t }); }
    }
    if (this.cache.size > 60000) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }

  /** tier opacity for a zoom (CSS px per MU) — fades each tier in as its symbols reach a readable size and out when they get huge */
  static alpha(t: number, s: number): number {
    const px = cellSize(t) * s * 0.9;
    return smooth(11, 17, px) * (1 - smooth(34, 52, px));
  }

  collect(view: ViewRect, s: number, out: Placed[], alphas: number[]) {
    for (let t = 0; t < TIERS; t++) {
      const a = Scatter.alpha(t, s);
      alphas[t] = a;
      if (a < 0.03) continue;
      const cs = cellSize(t);
      const x0 = Math.max(0, Math.floor(view.x0 / cs)), x1 = Math.floor(Math.min(1600, view.x1) / cs);
      const y0 = Math.max(0, Math.floor(view.y0 / cs)), y1 = Math.floor(Math.min(900, view.y1) / cs);
      // glyphs fade in and out by dithering: each has a fixed random threshold, so density (not opacity) follows the zoom
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const p of this.cell(t, cx, cy)) if (p.q < a) out.push(p);
    }
  }
}

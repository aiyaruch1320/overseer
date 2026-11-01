// Coarse terrain fields (elevation, zone weights) shared by the colour map and the glyph scatterer.
import { DEFS, type LandDef, type Zone, type ZoneKind } from '../../world/geo';
import { makeNoise } from '../../sim/rng';
import { CELL, GW, GH, type Land } from './land';

const VW = GW + 1;
const nElev = makeNoise(9001), nRidge = makeNoise(9002);

export const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** how strongly a point sits inside a zone: 1 at its centre, fading to 0 at its rim */
export function zoneW(zn: Zone, x: number, y: number): number {
  let dx = x - zn.x, dy = y - zn.y;
  if (zn.rot) { const c = Math.cos(zn.rot), s = Math.sin(zn.rot); const t = dx * c + dy * s; dy = -dx * s + dy * c; dx = t; }
  const d = Math.sqrt((dx * dx) / (zn.rx * zn.rx) + (dy * dy) / (zn.ry * zn.ry));
  return (1 - smooth(0.35, 1, d)) * (zn.s ?? 1);
}
export function zoneOf(def: LandDef, kind: ZoneKind, x: number, y: number): number {
  let m = 0;
  if (def.zones) for (const zn of def.zones) if (zn.kind === kind) { const w = zoneW(zn, x, y); if (w > m) m = w; }
  return m;
}

export interface Fields {
  elev: Float32Array; // 0..1 per grid vertex (0 at sea)
  shade: Float32Array; // hillshade, roughly -0.5..0.5
}

export function buildFields(land: Land): Fields {
  const n = VW * (GH + 1);
  const elev = new Float32Array(n);
  for (let iy = 0; iy <= GH; iy++) for (let ix = 0; ix <= GW; ix++) {
    const i = iy * VW + ix;
    const o = land.owner[i];
    if (o < 0) continue;
    const def = DEFS[o];
    const x = ix * CELL, y = iy * CELL;
    const inl = land.inland[i];
    let e = (1 - Math.exp(-inl / 42)) * 0.3 + (nElev(x / 58, y / 58, 3) - 0.5) * 0.28 + 0.2;
    const mount = zoneOf(def, 'mountain', x, y), high = zoneOf(def, 'highland', x, y), crater = zoneOf(def, 'crater', x, y);
    if (mount > 0 || crater > 0) {
      const r = 1 - Math.abs(nRidge(x / 22, y / 22, 3) * 2 - 1);
      e += mount * (0.22 + 0.62 * Math.pow(r, 1.5)) + crater * (0.3 + 0.35 * r);
    }
    e += high * 0.2 * (0.6 + nRidge(x / 30 + 4, y / 30, 2));
    elev[i] = Math.max(0.02, Math.min(1, e));
  }
  const shade = new Float32Array(n);
  for (let iy = 1; iy < GH; iy++) for (let ix = 1; ix < GW; ix++) {
    const i = iy * VW + ix;
    if (land.owner[i] < 0) continue;
    shade[i] = (elev[i - VW - 1] - elev[i + VW + 1]) * 3.2 + (elev[i - 1] - elev[i + 1]) * 0.8;
  }
  return { elev, shade };
}

/** nearest-vertex probe used by the glyph scatterer */
export interface Probe { land: boolean; inland: number; def: number; elev: number; sea: number }
export function makeProbe(land: Land, ter: Fields) {
  const out: Probe = { land: false, inland: 0, def: -1, elev: 0, sea: 0 };
  return (x: number, y: number): Probe => {
    const gx = x / CELL, gy = y / CELL;
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) { out.land = false; return out; }
    const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const i = iy * VW + ix;
    const v = land.v[i] * (1 - fx) * (1 - fy) + land.v[i + 1] * fx * (1 - fy) + land.v[i + VW] * (1 - fx) * fy + land.v[i + VW + 1] * fx * fy;
    out.land = v > 0;
    if (!out.land) { out.sea = land.sea[i] * (1 - fx) * (1 - fy) + land.sea[i + 1] * fx * (1 - fy) + land.sea[i + VW] * (1 - fx) * fy + land.sea[i + VW + 1] * fx * fy; return out; }
    out.inland = land.inland[i] * (1 - fx) * (1 - fy) + land.inland[i + 1] * fx * (1 - fy) + land.inland[i + VW] * (1 - fx) * fy + land.inland[i + VW + 1] * fx * fy;
    out.elev = ter.elev[i] * (1 - fx) * (1 - fy) + ter.elev[i + 1] * fx * (1 - fy) + ter.elev[i + VW] * (1 - fx) * fy + ter.elev[i + VW + 1] * fx * fy;
    const near = fx < 0.5 ? (fy < 0.5 ? i : i + VW) : (fy < 0.5 ? i + 1 : i + VW + 1);
    out.def = land.owner[near] >= 0 ? land.owner[near] : Math.max(land.owner[i], land.owner[i + 1], land.owner[i + VW], land.owner[i + VW + 1]);
    return out;
  };
}

// Turns the land field into vector coastlines (marching squares → closed loops) plus the coarse grids the painter needs.
import { DEFS, MAP_MW, MAP_MH, sampleLand } from '../../world/geo';

export const CELL = 2; // MU per grid cell
export const GW = MAP_MW / CELL;
export const GH = MAP_MH / CELL;
const VW = GW + 1;

export interface Loop { def: number; pts: Float32Array; area: number } // pts are MU, x/y interleaved, closed implicitly

export interface Land {
  v: Float32Array; // land value per grid vertex (> 0 land)
  owner: Int16Array; // DEFS index per vertex (-1 sea)
  inland: Float32Array; // MU to the nearest water, 0 at sea
  sea: Float32Array; // MU from open water to the nearest ground coast (floating islands don't count), 0 on land
  loops: Loop[][]; // per DEFS index
}

export function buildLand(): Land {
  const v = new Float32Array(VW * (GH + 1));
  const owner = new Int16Array(VW * (GH + 1)).fill(-1);
  for (let iy = 0; iy <= GH; iy++) for (let ix = 0; ix <= GW; ix++) {
    const s = sampleLand(ix * CELL, iy * CELL);
    const i = iy * VW + ix;
    // keep the sheet's border in the sea so every coast closes
    const edge = ix === 0 || iy === 0 || ix === GW || iy === GH;
    v[i] = edge ? -5 : s.v;
    if (v[i] > 0) owner[i] = s.def;
  }
  const ground = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) ground[i] = v[i] > 0 && !DEFS[owner[i]].float ? -1 : 1; // inverted mask: distance to ground land
  return { v, owner, inland: distanceToWater(v), sea: distanceToWater(ground), loops: contour(v, owner) };
}

function distanceToWater(v: Float32Array): Float32Array {
  const d = new Float32Array(v.length);
  const BIG = 1e6;
  for (let i = 0; i < v.length; i++) d[i] = v[i] > 0 ? BIG : 0;
  const D1 = CELL, D2 = CELL * Math.SQRT2;
  for (let iy = 0; iy <= GH; iy++) for (let ix = 0; ix <= GW; ix++) {
    const i = iy * VW + ix;
    if (d[i] === 0) continue;
    let m = d[i];
    if (ix > 0) m = Math.min(m, d[i - 1] + D1);
    if (iy > 0) { m = Math.min(m, d[i - VW] + D1); if (ix > 0) m = Math.min(m, d[i - VW - 1] + D2); if (ix < GW) m = Math.min(m, d[i - VW + 1] + D2); }
    d[i] = m;
  }
  for (let iy = GH; iy >= 0; iy--) for (let ix = GW; ix >= 0; ix--) {
    const i = iy * VW + ix;
    if (d[i] === 0) continue;
    let m = d[i];
    if (ix < GW) m = Math.min(m, d[i + 1] + D1);
    if (iy < GH) { m = Math.min(m, d[i + VW] + D1); if (ix < GW) m = Math.min(m, d[i + VW + 1] + D2); if (ix > 0) m = Math.min(m, d[i + VW - 1] + D2); }
    d[i] = m;
  }
  return d;
}

/** marching squares over a (gw+1) × (gh+1) vertex grid; returns closed loops in map units, each tagged with the owner of its land */
function trace(v: Float32Array, gw: number, gh: number, cell: number, ownerOf: (cellIdx: number[]) => number, ox = 0): { pts: Float32Array; area: number; def: number }[] {
  const vw = gw + 1;
  const px = new Map<number, number>(), py = new Map<number, number>(), own = new Map<number, number>();
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    let la = adj.get(a); if (!la) adj.set(a, (la = [])); la.push(b);
    let lb = adj.get(b); if (!lb) adj.set(b, (lb = [])); lb.push(a);
  };
  const corners = [0, 0, 0, 0];
  for (let cy = 0; cy < gh; cy++) for (let cx = 0; cx < gw; cx++) {
    const itl = cy * vw + cx, itr = itl + 1, ibl = itl + vw, ibr = ibl + 1;
    const a = v[itl], b = v[itr], c = v[ibr], d = v[ibl];
    const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
    if (idx === 0 || idx === 15) continue;
    corners[0] = itl; corners[1] = itr; corners[2] = ibr; corners[3] = ibl;
    const o = ownerOf(corners);
    // crossing points: T (top edge), R, B, L — keyed by the edge they sit on
    const T = (cy * vw + cx) * 2, R = (cy * vw + cx + 1) * 2 + 1, B = ((cy + 1) * vw + cx) * 2, L = (cy * vw + cx) * 2 + 1;
    const put = (k: number, x: number, y: number) => { if (!px.has(k)) { px.set(k, x); py.set(k, y); own.set(k, o); } };
    const t = (p: number, q: number) => p / (p - q);
    if ((a > 0) !== (b > 0)) put(T, cx + t(a, b), cy);
    if ((b > 0) !== (c > 0)) put(R, cx + 1, cy + t(b, c));
    if ((d > 0) !== (c > 0)) put(B, cx + t(d, c), cy + 1);
    if ((a > 0) !== (d > 0)) put(L, cx, cy + t(a, d));
    switch (idx) {
      case 1: case 14: link(L, T); break;
      case 2: case 13: link(T, R); break;
      case 3: case 12: link(L, R); break;
      case 4: case 11: link(R, B); break;
      case 6: case 9: link(T, B); break;
      case 7: case 8: link(L, B); break;
      case 5: if ((a + b + c + d) / 4 > 0) { link(L, B); link(T, R); } else { link(L, T); link(R, B); } break;
      case 10: if ((a + b + c + d) / 4 > 0) { link(L, T); link(R, B); } else { link(T, R); link(L, B); } break;
    }
  }
  const loops: { pts: Float32Array; area: number; def: number }[] = [];
  const seen = new Set<number>();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const ks: number[] = [];
    let prev = -1, cur = start;
    for (;;) {
      seen.add(cur); ks.push(cur);
      const nb = adj.get(cur)!;
      const next = nb[0] !== prev && !seen.has(nb[0]) ? nb[0] : nb.length > 1 && nb[1] !== prev && !seen.has(nb[1]) ? nb[1] : -1;
      if (next < 0) break;
      prev = cur; cur = next;
    }
    if (ks.length < 4) continue;
    const pts = new Float32Array(ks.length * 2);
    let area = 0;
    for (let i = 0; i < ks.length; i++) { pts[i * 2] = px.get(ks[i])! * cell + ox; pts[i * 2 + 1] = py.get(ks[i])! * cell + ox; }
    for (let i = 0; i < ks.length; i++) { const j = (i + 1) % ks.length; area += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1]; }
    loops.push({ pts, area: area / 2, def: own.get(start)! });
  }
  return loops;
}

function contour(v: Float32Array, owner: Int16Array): Loop[][] {
  const out: Loop[][] = DEFS.map(() => []);
  const raw = trace(v, GW, GH, CELL, (c) => Math.max(owner[c[0]], owner[c[1]], owner[c[2]], owner[c[3]]));
  for (const l of raw) {
    if (l.def < 0) continue;
    const keep = DEFS[l.def].country !== undefined || DEFS[l.def].bridge || Math.abs(l.area) > 5;
    if (keep) out[l.def].push(l);
  }
  return out;
}

/** outline of a set of tiles (a country) as smooth-able loops in map units; `inside(i)` says whether tile i belongs */
export function traceMask(inside: (i: number) => boolean, w: number, h: number, tileMU: number): Float32Array[] {
  const gw = w + 1, gh = h + 1; // one empty tile of padding so every loop closes
  const v = new Float32Array((gw + 1) * (gh + 1)).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(y * w + x)) v[(y + 1) * (gw + 1) + x + 1] = 1;
  // tile edges are staircases: relax each loop a few times so the outline reads as a smooth border
  return trace(v, gw, gh, tileMU, () => 0, -tileMU / 2).filter((l) => l.area > 0.5 || l.area < -0.5).map((l) => relax(l.pts, 4));
}

function relax(pts: Float32Array, rounds: number): Float32Array {
  const n = pts.length / 2;
  let a = pts, b = new Float32Array(pts.length);
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n; i++) {
      const p = ((i + n - 1) % n) * 2, q = ((i + 1) % n) * 2;
      b[i * 2] = a[p] * 0.25 + a[i * 2] * 0.5 + a[q] * 0.25;
      b[i * 2 + 1] = a[p + 1] * 0.25 + a[i * 2 + 1] * 0.5 + a[q + 1] * 0.25;
    }
    [a, b] = [b, a];
  }
  return a;
}

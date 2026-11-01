// The painted ground: one smooth colour per grid vertex (continent palette × elevation × zones × hillshade),
// drawn under the vector detail and scaled up with bilinear smoothing (it only carries low-frequency colour).
import { CONT, DEFS, type ZoneKind } from '../../world/geo';
import { makeNoise } from '../../sim/rng';
import { CELL, GW, GH, type Land } from './land';
import { zoneOf, smooth, type Fields } from './fields';

type RGB = [number, number, number];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
const lit = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

const n1 = makeNoise(31), n2 = makeNoise(32), n3 = makeNoise(33), nRock = makeNoise(34);
const VW = GW + 1;

interface Ctx { x: number; y: number; inl: number; e: number; shade: number; a: number; b: number; c: number; z: (k: ZoneKind) => number }

// ---- palettes ----
const C = {
  meadowA: hex(0x93c46c), meadowB: hex(0x75b05a), grassL: hex(0xaed57a), farmA: hex(0xd2c673), farmB: hex(0xa6cc6a), farmC: hex(0xc9a860), forest: hex(0x4f8f4c), hill: hex(0x9a9a62), town: hex(0xcdbf94), rock: hex(0x8d8a7c),
  silA: hex(0x2f7d3d), silB: hex(0x236a35), silL: hex(0x58ad55), tree: hex(0x93e07a), swamp: hex(0x2f6a5c), silHill: hex(0x4b7048),
  nebA: hex(0x717f98), nebB: hex(0x5b6a86), nebFog: hex(0xa9b3c6), nebPit: hex(0x252d44), nebSwamp: hex(0x4b6c70),
  mecA: hex(0x7d7c72), mecB: hex(0x6a6b64), rust: hex(0x93694a), soot: hex(0x4f4e4b), mecFarm: hex(0x8c9b64), mecRuin: hex(0x9a9484), mecBad: hex(0x8a7356),
  sandA: hex(0xe6c97f), sandB: hex(0xd8b26a), dune: hex(0xcf9e58), glass: hex(0xf1e6b8), oasis: hex(0x6fae5a), mtn: hex(0x8c7a68), mtnHi: hex(0xb9ad9d), snow: hex(0xf3f0ea), sandHill: hex(0xa8895f),
  basA: hex(0x40342f), basB: hex(0x4d3e38), ash: hex(0x726c68), lava: hex(0xff7a1c), lavaDk: hex(0xc2360c), kazHill: hex(0x5e403a), obs: hex(0x1d1820),
  dustA: hex(0x9d7e5a), dustB: hex(0x876b4c), crack: hex(0x5a4530), morAsh: hex(0x726a60), morBlood: hex(0x8a4636),
  isleA: hex(0x7fcb82), isleB: hex(0x5db56d), sandShore: hex(0xf0e2ab),
  skyA: hex(0xa4da7e), skyB: hex(0x88c96a), skyStone: hex(0xd9d0bc), skyMine: hex(0x9a7a56), skyFog: hex(0x7b8fa8),
};
export const SHORE: Record<number, RGB> = {
  [CONT.aldria]: hex(0xe9dca9), [CONT.silvanel]: hex(0x4c8f5f), [CONT.nebulia]: hex(0x8f9aaf), [CONT.mecharia]: hex(0x9b9588), [CONT.saharan]: hex(0xf0e2b0),
  [CONT.kazdurum]: hex(0x2c2624), [CONT.morhaven]: hex(0x8d8579), [CONT.nerea]: hex(0xf3e6b0), [CONT.azgar]: hex(0xefe6c8),
};

function fieldPatch(x: number, y: number): number {
  const px = x + 7 * Math.sin(y / 11) + 5 * Math.sin(y / 5.3), py = y + 7 * Math.sin(x / 13);
  const cx = Math.floor(px / 15), cy = Math.floor(py / 12);
  let h = (cx * 374761393 + cy * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return (h & 1023) / 1023;
}

const painters: Record<number, (c: Ctx) => RGB> = {
  [CONT.aldria]: (c) => {
    let col = mix(C.meadowA, C.meadowB, c.a);
    col = mix(col, C.grassL, c.z('grass') * 0.55 * c.b);
    const farm = c.z('farm');
    if (farm > 0) { const p = fieldPatch(c.x, c.y); col = mix(col, p < 0.33 ? C.farmA : p < 0.66 ? C.farmB : C.farmC, farm * 0.8); }
    col = mix(col, C.forest, c.z('forest') * (0.35 + c.b * 0.6));
    col = mix(col, C.hill, c.z('highland') * 0.85);
    col = mix(col, C.town, c.z('city') * 0.32);
    return mix(col, C.rock, smooth(0.62, 0.9, c.e) * 0.7);
  },
  [CONT.silvanel]: (c) => {
    let col = mix(C.silA, C.silB, c.a);
    col = mix(col, C.silL, (0.25 + c.b * 0.6) * 0.55 * c.z('forest'));
    col = mix(col, C.tree, c.z('tree') * 0.8);
    col = mix(col, C.swamp, c.z('swamp') * 0.85);
    col = mix(col, C.silHill, c.z('highland') * 0.8);
    return col;
  },
  [CONT.nebulia]: (c) => {
    let col = mix(C.nebA, C.nebB, c.a);
    col = mix(col, C.nebSwamp, c.z('swamp') * 0.7);
    col = mix(col, C.nebFog, c.z('fog') * (0.15 + c.b * 0.35));
    col = mix(col, C.nebPit, c.z('pit') * 0.9);
    return col;
  },
  [CONT.mecharia]: (c) => {
    let col = mix(C.mecA, C.mecB, c.a);
    col = mix(col, C.rust, smooth(0.55, 0.8, c.b) * 0.55);
    col = mix(col, C.soot, c.z('city') * (0.25 + c.b * 0.45));
    col = mix(col, C.mecFarm, c.z('farm') * 0.75);
    col = mix(col, C.mecRuin, c.z('ruin') * 0.9);
    col = mix(col, C.mecBad, c.z('badland') * 0.7);
    return mix(col, C.rock, c.z('highland') * 0.6);
  },
  [CONT.saharan]: (c) => {
    let col = mix(C.sandA, C.sandB, c.a);
    const dn = c.z('dune');
    if (dn > 0) col = mix(col, C.dune, dn * (0.5 + 0.5 * Math.sin((c.x * 0.6 + c.y * 0.35 + c.b * 22) * 0.45)) * 0.9);
    col = mix(col, C.glass, c.z('glass') * 0.8);
    col = mix(col, C.sandHill, c.z('highland') * 0.75);
    const mt = c.z('mountain');
    col = mix(col, mix(C.mtn, C.mtnHi, smooth(0.45, 0.9, c.e)), Math.max(mt * 0.95, smooth(0.62, 0.8, c.e) * 0.7));
    col = mix(col, C.snow, smooth(0.86, 1.0, c.e) * mt);
    return mix(col, C.oasis, c.z('oasis') * 0.9);
  },
  [CONT.kazdurum]: (c) => {
    let col = mix(C.basA, C.basB, c.a);
    col = mix(col, C.kazHill, c.z('highland') * 0.7);
    col = mix(col, C.ash, c.z('ash') * (0.35 + 0.4 * c.b));
    const lv = c.z('lava') + c.z('crater') * 0.8;
    if (lv > 0) {
      const r = 1 - Math.abs(nRock(c.x / 14, c.y / 14, 3) * 2 - 1);
      col = mix(col, mix(C.lavaDk, C.lava, r), smooth(0.6, 0.86, r) * lv);
    }
    return mix(col, C.obs, c.z('pit') * 0.95);
  },
  [CONT.morhaven]: (c) => {
    let col = mix(C.dustA, C.dustB, c.a);
    col = mix(col, C.morBlood, smooth(0.6, 0.85, c.b) * 0.35);
    col = mix(col, C.morAsh, c.z('ash') * 0.7);
    const bd = c.z('badland');
    if (bd > 0) { const r = 1 - Math.abs(nRock(c.x / 9 + 3, c.y / 9, 2) * 2 - 1); col = mix(col, C.crack, smooth(0.8, 0.95, r) * bd * 0.8); }
    col = mix(col, C.lavaDk, c.z('lava') * 0.7);
    col = mix(col, C.obs, c.z('pit') * 0.9);
    return mix(col, C.oasis, c.z('oasis') * 0.85);
  },
  [CONT.nerea]: (c) => {
    let col = mix(C.isleA, C.isleB, c.a);
    col = mix(col, C.town, c.z('city') * 0.4);
    return mix(col, C.oasis, c.z('oasis') * 0.5);
  },
  [CONT.azgar]: (c) => {
    let col = mix(C.skyA, C.skyB, c.a);
    col = mix(col, C.skyStone, Math.max(c.z('city'), c.z('ruin')) * 0.55);
    col = mix(col, C.farmB, c.z('farm') * 0.5);
    col = mix(col, C.skyMine, c.z('badland') * 0.8);
    col = mix(col, C.lavaDk, c.z('lava') * 0.7);
    col = mix(col, C.skyFog, c.z('fog') * 0.5);
    return mix(col, C.mtnHi, c.z('mountain') * 0.6);
  },
};

/** paints the ground colour map (one pixel per grid vertex); sea pixels next to land are filled with the nearest land colour so bilinear scaling never bleeds blue into the coast */
export function buildGround(land: Land, ter: Fields): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = VW; cv.height = GH + 1;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(VW, GH + 1);
  const d = img.data;
  const filled = new Uint8Array(VW * (GH + 1));
  for (let iy = 0; iy <= GH; iy++) for (let ix = 0; ix <= GW; ix++) {
    const i = iy * VW + ix;
    const o = land.owner[i];
    if (o < 0) continue;
    const def = DEFS[o];
    const x = ix * CELL, y = iy * CELL;
    const cx: Ctx = {
      x, y, inl: land.inland[i], e: ter.elev[i], shade: ter.shade[i],
      a: n1(x / 46, y / 46, 3), b: n2(x / 17 + 9, y / 17, 2), c: n3(x / 7, y / 7, 2),
      z: (k) => zoneOf(def, k, x, y),
    };
    let col = painters[def.cont](cx);
    // low coastal strip tint, then relief
    col = mix(col, SHORE[def.cont], (1 - smooth(1.2, 6.5, cx.inl)) * 0.55);
    col = lit(col, 1 + Math.max(-0.2, Math.min(0.2, cx.shade)) * 0.8 + (cx.c - 0.5) * 0.1);
    const p = i * 4;
    d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    filled[i] = 1;
  }
  // soften the seam where two continents' palettes meet (necks of land): average each vertex with its land neighbours there
  const seam: number[] = [];
  for (let iy = 2; iy < GH - 1; iy++) for (let ix = 2; ix < GW - 1; ix++) {
    const i = iy * VW + ix, o = land.owner[i];
    if (o < 0 || DEFS[o].float) continue;
    const c = DEFS[o].cont;
    let diff = false;
    for (let dy = -2; dy <= 2 && !diff; dy++) for (let dx = -2; dx <= 2; dx++) { const q = land.owner[i + dy * VW + dx]; if (q >= 0 && DEFS[q].cont !== c) { diff = true; break; } }
    if (diff) seam.push(i);
  }
  const keep = new Uint8ClampedArray(d);
  for (const i of seam) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const q = i + dy * VW + dx; if (land.owner[q] >= 0) { r += keep[q * 4]; g += keep[q * 4 + 1]; b += keep[q * 4 + 2]; n++; } }
    d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n;
  }
  // grow the colour 4 vertices into the sea
  for (let pass = 0; pass < 4; pass++) {
    const add: number[] = [];
    for (let iy = 0; iy <= GH; iy++) for (let ix = 0; ix <= GW; ix++) {
      const i = iy * VW + ix;
      if (filled[i]) continue;
      const nb = [ix > 0 ? i - 1 : -1, ix < GW ? i + 1 : -1, iy > 0 ? i - VW : -1, iy < GH ? i + VW : -1];
      for (const q of nb) if (q >= 0 && filled[q]) { add.push(i, q); break; }
    }
    for (let k = 0; k < add.length; k += 2) { const i = add[k], q = add[k + 1]; d[i * 4] = d[q * 4]; d[i * 4 + 1] = d[q * 4 + 1]; d[i * 4 + 2] = d[q * 4 + 2]; d[i * 4 + 3] = 255; }
    for (let k = 0; k < add.length; k += 2) filled[add[k]] = 1;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// shallow water: a smooth colour ramp by distance from the nearest ground coast (soft by nature, so a bilinear image is enough)
const RAMP: [number, RGB][] = [
  [0, hex(0x6cc3cf)], [1.6, hex(0x58b0c4)], [4, hex(0x3f95b2)], [8, hex(0x2f7b9e)], [14, hex(0x246388)], [24, hex(0x1b4b6e)], [38, hex(0x143a5c)], [60, hex(0x102c48)],
];
export function buildShallows(land: Land): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = VW; cv.height = GH + 1;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(VW, GH + 1);
  for (let i = 0; i < VW * (GH + 1); i++) {
    const d = land.sea[i];
    let k = 1;
    while (k < RAMP.length - 1 && d > RAMP[k][0]) k++;
    const [d0, c0] = RAMP[k - 1], [d1, c1] = RAMP[k];
    // fade to open-ocean blue toward the sheet's edge so it joins the sea beyond it
    const ix = i % VW, iy = Math.floor(i / VW), edge = Math.min(ix, iy, GW - ix, GH - iy) * CELL;
    const col = mix(RAMP[RAMP.length - 1][1], mix(c0, c1, (d - d0) / (d1 - d0)), smooth(0, 80, edge));
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

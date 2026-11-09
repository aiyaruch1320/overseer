// The ground of a town as pixel art (21-pixel-art.md §4: "the ground is painted by code as tiles; people, houses and trees are sprites"). From the plan of
// a town (city.ts, in map units) it rasterises one picture of TOWN_PX art pixels to the map unit: the grass in three dithered tones, the packed earth of the
// built-up part, the fields with their furrows, the water and its banks, the streets, the plaza, the wall, and the ash and glass of a ruin. The rim is
// dithered away (no soft edge), so the country shows round the town. The same pass makes the grid the people walk on. Pure: no DOM (the canvas is the caller's).
import type { CityLook, CityPlan } from './city';
import { Stream, clamp, hashString, makeNoise } from './noise';
import { TOWN_PX } from './tuning';
import { parse, mixHex, shadeHex, toHex, type Rgb } from '../art/mapart/color';

type Pt = [number, number];

const BAYER8 = (() => {
  const m = new Float32Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      let v = 0;
      for (let b = 0; b < 3; b++) v = (v << 2) | ((((x >> b) ^ (y >> b)) & 1) << 1) | ((y >> b) & 1);
      m[y * 8 + x] = (v + 0.5) / 64;
    }
  return m;
})();
const bayer = (x: number, y: number) => BAYER8[(y & 7) * 8 + (x & 7)];

export interface WalkGrid {
  /** Art pixels per cell. */
  cell: number;
  cols: number;
  rows: number;
  /** 1 where a person can stand. */
  ok: Uint8Array;
  /** 1 where the cell is a street or the plaza. */
  road: Uint8Array;
}

export interface TownGround {
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
  walk: WalkGrid;
}

/** The size in art pixels of the ground of a plan. */
export const groundSize = (plan: Pick<CityPlan, 'w' | 'h'>): { w: number; h: number } => ({ w: Math.ceil(plan.w * TOWN_PX), h: Math.ceil(plan.h * TOWN_PX) });

const WALL_COLOR: Record<string, string> = { iron: '#4a4e56', palisade: '#6a4a2c', hedge: '#3f7a3a', stone: '#9a948a' };

/** Stamps `value` into `mask` on every pixel within `r` of the polyline. */
function stroke(mask: Uint8Array, W: number, H: number, pts: Pt[], r: number, value: number): void {
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / L2, 0, 1);
        const ex = ax + dx * t - (x + 0.5), ey = ay + dy * t - (y + 0.5);
        if (ex * ex + ey * ey <= r2) mask[y * W + x] = value;
      }
  }
}

export function townGround(plan: CityPlan, look: CityLook = {}): TownGround {
  const { w: W, h: H } = groundSize(plan);
  const S = TOWN_PX;
  const seed = hashString(plan.id);
  const noise = makeNoise(seed & 0xffff), noise2 = makeNoise((seed >>> 8) & 0xffff);
  const ruin = look.ruin ?? 0;
  const px = new Uint8ClampedArray(W * H * 4);

  // masks
  const road = new Uint8Array(W * H), water = new Uint8Array(W * H), field = new Uint8Array(W * H), wall = new Uint8Array(W * H);
  for (const s of plan.streets) {
    const pts = s.pts.map((p) => [p[0] * S, p[1] * S] as Pt);
    stroke(road, W, H, pts, (s.width * S) / 2 + 1.2, 2); // the dark edge
  }
  for (const s of plan.streets) {
    const pts = s.pts.map((p) => [p[0] * S, p[1] * S] as Pt);
    stroke(road, W, H, pts, (s.width * S) / 2, 1);
  }
  for (const wt of plan.water) {
    const pts = wt.pts.map((p) => [p[0] * S, p[1] * S] as Pt);
    stroke(water, W, H, pts, (wt.width * S) / 2 + 2.5, 2); // the bank
    stroke(water, W, H, pts, (wt.width * S) / 2, 1);
  }
  plan.fields.forEach((f, fi) => {
    const c = Math.cos(f.rot), sn = Math.sin(f.rot), hw = (f.w * S) / 2, hh = (f.h * S) / 2, ext = Math.hypot(hw, hh);
    const cx = f.x * S, cy = f.y * S;
    for (let y = Math.max(0, Math.floor(cy - ext)); y <= Math.min(H - 1, Math.ceil(cy + ext)); y++)
      for (let x = Math.max(0, Math.floor(cx - ext)); x <= Math.min(W - 1, Math.ceil(cx + ext)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
        if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) field[y * W + x] = Math.min(255, fi + 1);
      }
  });
  if (plan.wall) {
    const kind = plan.wall.kind;
    const hw = kind === 'hedge' ? 4 : 5;
    const ring = plan.wall.ring.map((p) => [p[0] * S, p[1] * S] as Pt);
    stroke(wall, W, H, ring, hw, 1);
    // the gates are gaps in the wall
    for (const g of plan.wall.gates) {
      const gx = g[0] * S, gy = g[1] * S, gr = S * 0.75;
      for (let y = Math.max(0, Math.floor(gy - gr)); y <= Math.min(H - 1, Math.ceil(gy + gr)); y++)
        for (let x = Math.max(0, Math.floor(gx - gr)); x <= Math.min(W - 1, Math.ceil(gx + gr)); x++) if ((x - gx) ** 2 + (y - gy) ** 2 <= gr * gr) wall[y * W + x] = 0;
    }
  }

  // colours
  const g0 = parse(plan.ground), g1 = parse(shadeHex(plan.ground, -0.04)), g2 = parse(shadeHex(plan.ground, 0.035));
  const dirt = parse(mixHex(plan.ground, plan.earth, 0.55)), dirtD = parse(shadeHex(mixHex(plan.ground, plan.earth, 0.55), -0.14));
  const roadC = parse(plan.road), roadE = parse(shadeHex(plan.road, -0.35)), roadL = parse(shadeHex(plan.road, 0.08));
  const plazaC = parse(shadeHex(plan.road, 0.14)), plazaD = parse(shadeHex(plan.road, -0.12));
  const waterC = parse('#4a8aa8'), waterD = parse('#2e5e7a'), waterL = parse('#8ac0d8'), bank = parse(mixHex(plan.ground, '#b8a878', 0.5));
  const plank = parse('#7a5a38'), plankD = parse('#4a3420');
  const fieldC = plan.fields.map((f) => parse(f.col));
  const wallBase = parse(WALL_COLOR[plan.wall?.kind ?? 'stone'] ?? WALL_COLOR.stone);
  const wallTop = parse(shadeHex(toHex(wallBase), 0.22)), wallLow = parse(shadeHex(toHex(wallBase), -0.3));
  const ash = parse('#5a5650'), ashD = parse('#3a3834');
  const cx = plan.plaza.x * S, cy = plan.plaza.y * S, pr = plan.plaza.r * S;
  const rx = plan.rx * S * 1.15, ry = plan.ry * S * 1.15;

  const put = (i: number, c: Rgb, a = 255) => { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = a; };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, b = bayer(x, y);
      // rim: dithered away
      const ex = (x + 0.5 - W / 2) / (W / 2), ey = (y + 0.5 - H / 2) / (H / 2), e = Math.hypot(ex, ey);
      // (the threshold stays under 1: at 1.0 the last column stayed opaque in dashes and drew a faint line along the rim)
      if (e > 0.7 + (1 - b) * 0.26) { px[i * 4 + 3] = 0; continue; }
      // grass in three tones
      // three close tones; the border between two is a fine dither (one pixel), never a block of a different colour
      const n = noise(x / 14, y / 14, 2) + (b - 0.5) * 0.5;
      let c: Rgb = n < 0.4 ? g1 : n > 0.62 ? g2 : g0;
      const h = (Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0) / 4294967296;
      if (h < 0.02) c = g1; else if (h > 0.985) c = g2;
      // packed earth of the built-up part
      const f = 1 - Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (f > 0 && noise2(x / 6, y / 6, 2) + b * 0.35 < f * 1.25) c = h < 0.07 || (noise2(x / 3, y / 3, 2) > 0.7 && b > 0.5) ? dirtD : dirt;
      // fields
      const fi = field[i];
      if (fi) {
        const fl = plan.fields[fi - 1];
        const edge = x === 0 || y === 0 || field[i - 1] !== fi || field[i + 1] !== fi || field[i - W] !== fi || field[i + W] !== fi;
        const row = Math.floor((fl.rot ? x : y) / 3) % 2;
        c = parse(edge ? shadeHex(toHex(fieldC[fi - 1]), -0.3) : row ? shadeHex(toHex(fieldC[fi - 1]), -0.1) : toHex(fieldC[fi - 1]));
      }
      // water, its bank
      const wv = water[i];
      if (wv === 2) c = bank;
      if (wv === 1) {
        const ripple = noise(x / 5 + 40, y / 3, 2);
        c = ripple > 0.62 && (x + y) % 2 === 0 ? waterL : ripple < 0.38 ? waterD : waterC;
        if (water[i - 1] !== 1 || water[i + 1] !== 1 || water[i - W] !== 1 || water[i + W] !== 1) c = waterD;
      }
      // streets (over water, a bridge of planks)
      const rv = road[i];
      if (rv === 2 && wv !== 1) c = roadE;
      if (rv === 1) {
        if (wv === 1) c = x % 3 === 0 ? plankD : plank;
        else c = (x * 7 + y * 13) % 11 === 0 ? roadL : (x + y * 3) % 17 === 0 ? roadE : roadC;
      }
      // the plaza
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= pr) c = d > pr - 1.5 ? roadE : (x >> 2) + (y >> 2) & 1 ? plazaC : plazaD;
      // the wall: top face light, front face base, foot dark
      if (wall[i]) {
        const kind = plan.wall!.kind;
        const topOpen = !wall[i - W] || !wall[i - W * 2] || !wall[i - W * 3], footOpen = !wall[i + W];
        c = kind === 'palisade' ? (x % 3 === 0 ? wallLow : topOpen ? wallTop : wallBase) : kind === 'hedge' ? ((x + y) % 3 === 0 ? wallTop : (x * y) % 5 === 0 ? wallLow : wallBase) : footOpen ? wallLow : topOpen ? wallTop : wallBase;
      }
      // a ruin lies under ash
      if (ruin > 0.2 && b < 0.9 * ruin) c = (x + y * 2) % 7 === 0 ? ashD : ash;
      put(i, c);
    }
  if (ruin > 0.2) {
    // glassy shards (black glass, one bright edge), embers, rubble marks
    const r = new Stream(seed ^ 41);
    const area = (a: number) => Math.round(a * ruin);
    const spot = (): Pt => [clamp(cx + (r.next() * 2 - 1) * rx, 2, W - 3), clamp(cy + (r.next() * 2 - 1) * ry, 2, H - 3)];
    const dot = (x: number, y: number, c: Rgb) => { const i = (Math.round(y) * W + Math.round(x)); if (px[i * 4 + 3]) put(i, c); };
    for (let k = 0; k < area(70); k++) { const [x, y] = spot(); dot(x, y, [18, 19, 26]); dot(x + 1, y, [18, 19, 26]); dot(x, y + 1, [18, 19, 26]); dot(x + 1, y - 1, [160, 190, 200]); }
    for (let k = 0; k < area(14); k++) { const [x, y] = spot(); dot(x, y, [216, 106, 58]); }
    for (let k = 0; k < area(90); k++) { const [x, y] = spot(); dot(x, y, r.chance(0.5) ? [40, 36, 32] : [120, 110, 100]); dot(x + 1, y, [40, 36, 32]); }
  }

  return { w: W, h: H, data: px, walk: walkGrid(plan, road, water, wall) };
}

const CELL = 4;

function walkGrid(plan: CityPlan, road: Uint8Array, water: Uint8Array, wall: Uint8Array): WalkGrid {
  const { w: W, h: H } = groundSize(plan);
  const S = TOWN_PX;
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const ok = new Uint8Array(cols * rows), rd = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = Math.min(W - 1, i * CELL + CELL / 2), y = Math.min(H - 1, j * CELL + CELL / 2), k = Math.floor(y) * W + Math.floor(x);
      const ex = (x - W / 2) / (W / 2), ey = (y - H / 2) / (H / 2);
      const bridge = road[k] === 1;
      const good = Math.hypot(ex, ey) < 0.8 && (water[k] !== 1 || bridge) && !wall[k];
      ok[j * cols + i] = good ? 1 : 0;
      rd[j * cols + i] = good && (road[k] === 1 || Math.hypot(x - plan.plaza.x * S, y - plan.plaza.y * S) < plan.plaza.r * S) ? 1 : 0;
    }
  // houses, specials and trees take their footprint
  const block = (bx: number, by: number, hw: number, hh: number) => {
    for (let j = Math.max(0, Math.floor((by - hh) / CELL)); j <= Math.min(rows - 1, Math.floor((by + hh) / CELL)); j++)
      for (let i = Math.max(0, Math.floor((bx - hw) / CELL)); i <= Math.min(cols - 1, Math.floor((bx + hw) / CELL)); i++) { ok[j * cols + i] = 0; rd[j * cols + i] = 0; }
  };
  for (const b of plan.buildings) {
    const c = Math.abs(Math.cos(b.rot)), s = Math.abs(Math.sin(b.rot));
    block(b.x * S, b.y * S, ((b.w * c + b.h * s) * S) / 2 + 2, ((b.w * s + b.h * c) * S) / 2 + 1);
  }
  for (const t of plan.trees) block(t.x * S, t.y * S, 3, 2);
  return { cell: CELL, cols, rows, ok, road: rd };
}

// The plan of a town (world-map.md §3 "เมือง" and §4). `planCity` is pure data: from the UI values of the country (docs/appearance/countries/*:
// building styles, roof colours, street plan, wall, centre, extras, tree) and a seed it lays out streets, buildings, the wall, the fields and the trees
// in map units on a sheet of CITY_W × CITY_H. It is drawn as pixel art: the ground by townGround.ts, the houses and trees as sprites by src/art/mapart.
// The same plan serves the people of the town (they walk on its grid).
import type { Country } from '../core/data/types-npcs';
import { mix, shade } from './color';
import { Stream, clamp, hashString, makeNoise } from './noise';
import { CITY_H, CITY_W, FATE_BY_ID, GROUND, type FateId } from './tuning';

type Pt = [number, number];

export interface PlanBuilding {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  style: string;
  roof: string;
  wall: string;
  floors: number;
  /** A named special (extra, seat, sacred): drawn larger and apart. */
  special?: string;
  /** 0..1 chance in the hash order that the building is broken when the town is a ruin. */
  frail: number;
}

export interface CityPlan {
  id: string;
  w: number;
  h: number;
  continent: string;
  ground: string;
  road: string;
  streets: { pts: Pt[]; width: number; main: boolean }[];
  water: { pts: Pt[]; width: number }[];
  fields: { x: number; y: number; w: number; h: number; col: string; rot: number }[];
  plaza: { x: number; y: number; r: number };
  buildings: PlanBuilding[];
  wall: { kind: string; ring: Pt[]; gates: Pt[] } | null;
  centre: { kind: string; x: number; y: number };
  trees: { x: number; y: number; r: number; kind: string }[];
  lamps: Pt[];
  /** Leaf colours of the trees when the UI value gives them (`leaf=`); empty for the kind's own green. */
  leaf: string[];
  ambient: string;
  /** Bounds of the built-up part, for the people to stay inside. */
  rx: number;
  ry: number;
}

export interface CityLook {
  fate?: FateId;
  /** 0..1: how much of the town stands broken (a fallen country, a god ruin). */
  ruin?: number;
}

/** Per-continent defaults the country file does not give: how much farmland the town has and which trees stand in the open. */
const FARM: Record<string, number> = { AZ: 0.35, MH: 0.1, KD: 0, NR: 0.2, AL: 0.6, MK: 0.3, SH: 0.15, SV: 0.04, NB: 0.15 };
const TREES: Record<string, string> = { AZ: 'oak', MH: 'dead', KD: 'none', NR: 'palm', AL: 'oak', MK: 'none', SH: 'cactus', SV: 'jungle', NB: 'dead' };
/** `flora=` names → the tree kinds the sprite painter draws. */
const FLORA: Record<string, string> = { round: 'oak', fern: 'fern', conifer: 'pine', shrub: 'shrub', willow: 'willow', mushroom: 'mushroom', banana: 'palm', boulder: 'boulder', dead: 'dead' };
/** `leaf=` presets of the continent files (the colours of the leaves at dawn, at twilight, plain green). */
const LEAF_PRESET: Record<string, string[]> = { DAWN: ['#d89a7a', '#e8c08a', '#b8a060'], TWILIGHT: ['#7a6ab0', '#5a5aa0', '#8a7ac0'], GREEN: ['#3f8a3a', '#4a9a44', '#2e7a3e'] };
const ROAD: Record<string, string> = { AZ: '#dcd6c8', MH: '#8a7350', KD: '#4f4440', NR: '#b08a5a', AL: '#c8bc9c', MK: '#6a6e72', SH: '#c8a468', SV: '#8a6e4a', NB: '#6a6e72' };
const GROUND_CITY: Record<string, string> = { AZ: '#a4da7e', MH: '#9d7e5a', KD: '#45382f', NR: '#8cc860', AL: '#9ac870', MK: '#8a8f8c', SH: '#d8b878', SV: '#4a8a4a', NB: '#8c938f' };
const FALLBACK_ROOFS: Record<string, string[]> = {
  AZ: ['#3d78c4', '#c9a24a', '#e9e9f6'], MH: ['#6d4a36', '#5a3e30', '#8a3c30'], KD: ['#4a3a3a', '#3a3030', '#5a3a30'], NR: ['#4a7ab0', '#e0e0e0', '#3a9ab0'],
  AL: ['#a8503a', '#8a6a4a', '#6a7a8a'], MK: ['#8a3a2a', '#6a3a2a', '#8a94a4'], SH: ['#d8b060', '#b04a2a', '#e8e0c8'], SV: ['#6a5a34', '#8a5a8a', '#4a7a3a'], NB: ['#5a5a6a', '#7a1a2a', '#8a8e94'],
};

export function planSeed(id: string, seed: number): number {
  return (hashString(id) ^ Math.imul(seed + 1, 0x9e3779b1)) >>> 0;
}

export function planCity(country: Country, continent: string, cityId: string, capital: boolean, seed: number, look: CityLook = {}): CityPlan {
  const ui = country.ui;
  const rng = new Stream(planSeed(cityId, seed));
  const noise = makeNoise(planSeed(cityId, seed) & 0xffff);
  const W = CITY_W, H = CITY_H;
  const fate = look.fate ? FATE_BY_ID[look.fate] : undefined;
  const scale = capital ? ui.scale ?? 3 : clamp((ui.scale ?? 3) - 1 - (rng.chance(0.5) ? 1 : 0), 1, 4);
  const ext = clamp(0.3 + 0.05 * scale, 0.3, 0.52);
  const cx = W / 2 + rng.float(-1, 1), cy = H / 2 + rng.float(-0.6, 0.6);
  const rx = W * ext, ry = H * ext * 1.05;
  const plan = ui.plan || 'organic';
  const roofsIn = ui.roofs.length ? ui.roofs : FALLBACK_ROOFS[continent] ?? FALLBACK_ROOFS.AL;
  const roofs = fate ? fate.after.slice(0, 3).map((c, i) => mix(roofsIn[i % roofsIn.length], c, fate.tint * 0.8)) : roofsIn;
  const styles = Object.entries(ui.styles);
  const styleW = styles.map(([, w]) => w);
  const ground = fate ? mix(GROUND_CITY[continent] ?? GROUND.AL, fate.ground, fate.tint) : GROUND_CITY[continent] ?? '#9ac870';
  const road = fate ? mix(ROAD[continent] ?? '#c8bc9c', fate.after[0], 0.5) : ROAD[continent] ?? '#c8bc9c';

  const plaza = { x: cx, y: cy, r: capital ? 1.7 : 1.2 };
  const streets: CityPlan['streets'] = [];
  const water: CityPlan['water'] = [];
  const inEll = (x: number, y: number, k = 1) => ((x - cx) / (rx * k)) ** 2 + ((y - cy) / (ry * k)) ** 2 <= 1;
  const wobble = (a: Pt, b: Pt, steps: number, amp: number, nz: number): Pt[] => {
    const pts: Pt[] = [];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const off = (noise(t * 3 + nz, nz * 1.7, 2) - 0.5) * amp * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1));
      pts.push([a[0] + dx * t - (dy / L) * off, a[1] + dy * t + (dx / L) * off]);
    }
    return pts;
  };
  const ellPt = (a: number, k = 1.08): Pt => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  const gates: Pt[] = [];

  if (plan === 'grid' || plan === 'canal') {
    const ang = rng.float(-0.18, 0.18);
    const gx = rx / 4.2, gy = ry / 3.4;
    const rot = (x: number, y: number): Pt => [cx + (x - cx) * Math.cos(ang) - (y - cy) * Math.sin(ang), cy + (x - cx) * Math.sin(ang) + (y - cy) * Math.cos(ang)];
    for (let k = -4; k <= 4; k++) {
      const y = cy + k * gy;
      const half = rx * 1.08 * Math.sqrt(Math.max(0, 1 - ((y - cy) / (ry * 1.08)) ** 2));
      if (half > 1) streets.push({ pts: [rot(cx - half, y), rot(cx + half, y)], width: k === 0 ? 0.55 : 0.34, main: k === 0 });
      const x = cx + k * gx;
      const hy = ry * 1.08 * Math.sqrt(Math.max(0, 1 - ((x - cx) / (rx * 1.08)) ** 2));
      if (hy > 1) streets.push({ pts: [rot(x, cy - hy), rot(x, cy + hy)], width: k === 0 ? 0.55 : 0.34, main: k === 0 });
    }
    gates.push(rot(cx - rx * 1.08, cy), rot(cx + rx * 1.08, cy), rot(cx, cy - ry * 1.08), rot(cx, cy + ry * 1.08));
    if (plan === 'canal') {
      water.push({ pts: wobble([cx - rx * 1.4, cy + gy * 1.5], [cx + rx * 1.4, cy + gy * 1.5], 16, 0.8, 5), width: 1.0 });
      water.push({ pts: wobble([cx - gx * 1.5, cy - ry * 1.4], [cx - gx * 1.5, cy + ry * 1.4], 14, 0.8, 9), width: 0.8 });
    }
  } else if (plan === 'radial') {
    const spokes = rng.int(7, 11);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rng.float(-0.08, 0.08);
      streets.push({ pts: [[cx, cy], ...wobble([cx, cy], ellPt(a, 1.08), 8, 0.5, i + 3).slice(1)], width: i % 3 === 0 ? 0.5 : 0.34, main: i % 3 === 0 });
      if (i % 3 === 0) gates.push(ellPt(a, 1.08));
    }
    for (const rr of [0.34, 0.62, 0.9]) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]); }
      streets.push({ pts, width: 0.32, main: false });
    }
  } else {
    // organic: main roads wander in from the gates; side streets branch off them
    const n = rng.int(3, 5);
    const a0 = rng.float(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + rng.float(-0.35, 0.35);
      const g = ellPt(a, 1.08);
      gates.push(g);
      streets.push({ pts: wobble(g, [cx, cy], 14, 3.2, i * 2 + 1), width: 0.5, main: true });
    }
    const mains = streets.slice();
    for (const m of mains)
      for (let k = 0; k < 3 + scale; k++) {
        const i = rng.int(2, m.pts.length - 3);
        const p = m.pts[i], q = m.pts[i + 1];
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (rng.chance(0.5) ? 1 : -1) * rng.float(1.1, 2.0);
        const len = rng.float(3, 7);
        const e: Pt = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
        if (inEll(e[0], e[1], 1.1)) streets.push({ pts: wobble(p, e, 5, 1.2, k + i), width: 0.3, main: false });
      }
  }

  // occupancy of the ground so that nothing is built twice in one place
  const CELL = 0.25;
  const oc = new Uint8Array(Math.ceil(W / CELL) * Math.ceil(H / CELL));
  const ocW = Math.ceil(W / CELL);
  const taken = (x: number, y: number, w: number, h: number): boolean => {
    for (let yy = y - h / 2; yy <= y + h / 2; yy += CELL * 0.8)
      for (let xx = x - w / 2; xx <= x + w / 2; xx += CELL * 0.8) {
        const i = Math.floor(yy / CELL) * ocW + Math.floor(xx / CELL);
        if (i < 0 || i >= oc.length || xx < 0 || xx >= W || yy < 0 || yy >= H || oc[i]) return true;
      }
    return false;
  };
  const claim = (x: number, y: number, w: number, h: number) => {
    for (let yy = y - h / 2; yy <= y + h / 2; yy += CELL * 0.8)
      for (let xx = x - w / 2; xx <= x + w / 2; xx += CELL * 0.8) {
        const i = Math.floor(yy / CELL) * ocW + Math.floor(xx / CELL);
        if (i >= 0 && i < oc.length) oc[i] = 1;
      }
  };
  // roads and water take their ground first
  for (const s of streets)
    for (let i = 0; i + 1 < s.pts.length; i++) {
      const a = s.pts[i], b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= L; t += CELL * 0.6) claim(a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L, s.width + 0.15, s.width + 0.15);
    }
  for (const w of water)
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      for (let t = 0; t <= L; t += CELL * 0.6) claim(a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L, w.width + 0.3, w.width + 0.3);
    }
  claim(plaza.x, plaza.y, plaza.r * 2.2, plaza.r * 2.2);

  const buildings: PlanBuilding[] = [];
  const pickStyle = () => (styles.length ? styles[rng.weighted(styleW)][0] : 'gable');
  const wallOf = (roof: string) => mix(roof, '#efe6d2', 0.72);
  const place = (x: number, y: number, w: number, h: number, rot: number, style: string, special?: string, floors?: number) => {
    const roof = roofs[rng.int(0, roofs.length - 1)];
    buildings.push({ x, y, w, h, rot, style, roof: shade(roof, rng.float(-0.08, 0.08)), wall: wallOf(roof), floors: floors ?? 1, special, frail: rng.next() });
    claim(x, y, Math.abs(w * Math.cos(rot)) + Math.abs(h * Math.sin(rot)), Math.abs(w * Math.sin(rot)) + Math.abs(h * Math.cos(rot)));
  };

  // the specials first, near the plaza: the seat, the holy house and the extras the country is known for
  const specials: { kind: string; size: [number, number] }[] = [];
  if (ui.seat && ui.seat !== 'none') specials.push({ kind: ui.seat, size: [3.0, 2.2] });
  if (ui.sacred && ui.sacred !== 'none') specials.push({ kind: ui.sacred, size: [2.6, 2.4] });
  for (const [kind, n] of Object.entries(ui.extra)) for (let i = 0; i < Math.min(n, 3); i++) specials.push({ kind, size: [2.4, 1.8] });
  for (const sp of specials) {
    for (let tries = 0; tries < 80; tries++) {
      const a = rng.float(0, Math.PI * 2), d = rng.float(0.2, 0.7);
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      if (taken(x, y, sp.size[0] + 0.3, sp.size[1] + 0.3)) continue;
      place(x, y, sp.size[0], sp.size[1], 0, sp.kind, sp.kind, 2);
      break;
    }
  }

  // houses along the streets, both sides; denser and taller near the plaza
  for (const s of streets) {
    for (let i = 0; i + 1 < s.pts.length; i++) {
      const a = s.pts[i], b = s.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.2) continue;
      const rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      let t = rng.float(0, 0.6);
      while (t < L) {
        const px = a[0] + ((b[0] - a[0]) * t) / L, py = a[1] + ((b[1] - a[1]) * t) / L;
        const near = 1 - clamp(Math.hypot((px - cx) / rx, (py - cy) / ry), 0, 1);
        const bw = rng.float(1.0, 1.7) * (0.9 + near * 0.35), bh = rng.float(0.9, 1.4) * (0.9 + near * 0.3);
        for (const side of [-1, 1]) {
          if (!rng.chance(0.55 + near * 0.4)) continue;
          const off = s.width / 2 + Math.max(bw, bh) * 0.5 + 0.3;
          const x = px + nx * off * side, y = py + ny * off * side;
          if (!inEll(x, y, 1.02) || taken(x, y, Math.max(bw, bh) * 0.8, Math.max(bw, bh) * 0.8)) continue;
          place(x, y, bw, bh, rot + (side < 0 ? Math.PI : 0), pickStyle(), undefined, near > 0.55 && rng.chance(0.5) ? 2 : 1);
        }
        t += bw * 0.95;
      }
    }
  }
  // a second row behind the first where there is room
  const rowTwo = buildings.slice();
  for (const bd of rowTwo) {
    if (bd.special || !rng.chance(0.6)) continue;
    const dx = bd.x - cx, dy = bd.y - cy, d = Math.hypot(dx, dy) || 1;
    const x = bd.x + (dx / d) * 1.4, y = bd.y + (dy / d) * 1.4;
    if (inEll(x, y, 0.98) && !taken(x, y, 1.1, 1.1)) place(x, y, rng.float(0.9, 1.3), rng.float(0.8, 1.2), bd.rot, pickStyle());
  }

  // infill between the streets, thinner toward the edge
  for (let tries = 0; tries < 600 && buildings.length < 60 + scale * 28; tries++) {
    const a = rng.float(0, Math.PI * 2), d = Math.sqrt(rng.next()) * 0.96;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (!rng.chance(0.9 - d * 0.6)) continue;
    const bw = rng.float(0.9, 1.4), bh = rng.float(0.8, 1.2);
    if (taken(x, y, bw * 0.85, bh * 0.85)) continue;
    place(x, y, bw, bh, rng.pick([0, 0, Math.PI / 2, rng.float(-0.4, 0.4)]), pickStyle(), undefined, d < 0.4 && rng.chance(0.4) ? 2 : 1);
  }

  // wall and gates
  let wall: CityPlan['wall'] = null;
  const wk = ui.wall && ui.wall !== 'none' ? ui.wall : null;
  if (wk) {
    const ring: Pt[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const k = 1.1 + (noise(Math.cos(a) * 2 + 7, Math.sin(a) * 2 + 7, 2) - 0.5) * 0.12;
      ring.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    wall = { kind: wk, ring, gates };
  }

  // fields outside the walls, trees in the open
  const fields: CityPlan['fields'] = [];
  const farmUi = Number(ui.other?.farm);
  const farm = Number.isFinite(farmUi) && ui.other?.farm ? clamp(farmUi * 0.5, 0, 1.2) : FARM[continent] ?? 0.2;
  if (farm > 0) {
    const cols = continent === 'AL' ? ['#cfe0a0', '#e2d27a', '#a9cc7e', '#d8c48a'] : ['#cfe8b0', '#a9d68a', '#d8d090'];
    const fcols = fate ? cols.map((c) => mix(c, fate.after[1], fate.tint * 0.7)) : cols;
    for (let tries = 0; tries < 260 && fields.length < 28 * farm + 4; tries++) {
      const x = rng.float(0.5, W - 0.5), y = rng.float(0.5, H - 0.5);
      if (inEll(x, y, 1.18)) continue;
      const w = rng.float(2.2, 4.2), h = rng.float(1.2, 2.4);
      if (taken(x, y, w, h)) continue;
      claim(x, y, w, h);
      fields.push({ x, y, w, h, col: fcols[rng.int(0, fcols.length - 1)], rot: rng.chance(0.5) ? 0 : Math.PI / 2 });
    }
  }
  const treeKind = ui.other?.tree && ui.other.tree !== 'none' ? ui.other.tree : TREES[continent] ?? 'oak';
  // `flora=` (round fern conifer shrub willow mushroom banana boulder dead): the kinds that stand in the open besides the main tree
  const flora = (ui.other?.flora ?? '').split(',').map((f) => FLORA[f.trim()]).filter(Boolean);
  const trees: CityPlan['trees'] = [];
  if (treeKind !== 'none') {
    const dens = continent === 'SV' ? 160 : continent === 'MH' || continent === 'NB' ? 30 : 70;
    for (let i = 0; i < dens; i++) {
      const x = rng.float(0.3, W - 0.3), y = rng.float(0.3, H - 0.3);
      if (taken(x, y, 0.6, 0.6)) continue;
      claim(x, y, 0.5, 0.5);
      trees.push({ x, y, r: rng.float(0.28, 0.5), kind: flora.length && rng.chance(0.75) ? rng.pick(flora) : treeKind });
    }
  }
  const lamps: Pt[] = [];
  if (ui.other?.lamps === 'true') for (const s of streets) if (s.main) for (let i = 1; i < s.pts.length; i += 2) lamps.push(s.pts[i]);
  const leafUi = (ui.other?.leaf ?? ui.other?.leafcolors ?? '').trim();
  const leaf = leafUi.startsWith('#') ? leafUi.split(',').map((c) => c.trim()) : LEAF_PRESET[leafUi.toUpperCase()] ?? [];
  const centre = { kind: ui.centre && ui.centre !== 'none' ? ui.centre : 'plaza', x: cx, y: cy };
  return { id: cityId, w: W, h: H, continent, ground, road, streets, water, fields, plaza, buildings, wall, centre, trees, lamps, leaf, ambient: ui.ambient || 'none', rx, ry };
}

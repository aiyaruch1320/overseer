// The plan of a town and how it is painted (world-map.md §3 "เมือง" and §4, ported in spirit from legacy/city). `planCity` is pure data: from the UI
// values of the country (docs/appearance/countries/*: building styles, roof colours, street plan, wall, centre, extras) and a seed it lays out
// streets, buildings, the wall, the fields and the trees in map units on a sheet of CITY_W × CITY_H. `paintCity` draws a plan on a canvas.
// The same plan serves the people of the inside level (they walk along `streets`).
import type { Country } from '../core/data/types-npcs';
import { css, mix, rgb, shade } from './color';
import { Stream, clamp, hashString, makeNoise } from './noise';
import { CITY_H, CITY_W, FATE_BY_ID, GROUND, type FateId } from './tuning';
import type { PaintCanvas } from './provider';

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
  const farm = FARM[continent] ?? 0.2;
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
  const treeKind = TREES[continent] ?? 'oak';
  const trees: CityPlan['trees'] = [];
  if (treeKind !== 'none') {
    const dens = continent === 'SV' ? 160 : continent === 'MH' || continent === 'NB' ? 30 : 70;
    for (let i = 0; i < dens; i++) {
      const x = rng.float(0.3, W - 0.3), y = rng.float(0.3, H - 0.3);
      if (taken(x, y, 0.6, 0.6)) continue;
      claim(x, y, 0.5, 0.5);
      trees.push({ x, y, r: rng.float(0.28, 0.5), kind: treeKind });
    }
  }
  const lamps: Pt[] = [];
  for (const s of streets) if (s.main) for (let i = 1; i < s.pts.length; i += 2) lamps.push(s.pts[i]);
  const centre = { kind: ui.centre && ui.centre !== 'none' ? ui.centre : 'plaza', x: cx, y: cy };
  return { id: cityId, w: W, h: H, continent, ground, road, streets, water, fields, plaza, buildings, wall, centre, trees, lamps, ambient: ui.ambient || 'none', rx, ry };
}

// ---------- painting ----------

const SPECIAL_COLOR: Record<string, string> = {
  palace: '#e8e0c8', castle: '#8a8a90', hall: '#b09070', manor: '#c8b898', tent: '#c8a878', temple: '#e0d8c0', shrine: '#d8d0b8', altar: '#9a9488', cathedral: '#ece6d8',
  forgealtar: '#5a4040', warehouse: '#9a7a52', library: '#8a6a4a', barracks: '#7a6a5a', market: '#c85a3a', arena: '#c8b080', granary: '#c8a050', minehead: '#4a4040',
  aerie: '#d8d4cc', fortress: '#6a6a70', drill: '#8a7a5a', skydock: '#b8c8d8',
};

export function paintCity(canvas: PaintCanvas, plan: CityPlan, look: CityLook = {}): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s = canvas.width / plan.w;
  const ruin = look.ruin ?? 0;
  const rng = new Stream(planSeed(plan.id, 99));
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // ground with a speckle
  ctx.fillStyle = plan.ground;
  ctx.fillRect(0, 0, plan.w, plan.h);
  const gr = new Stream(planSeed(plan.id, 5));
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = gr.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const r = gr.float(0.15, 0.7);
    ctx.beginPath(); ctx.arc(gr.float(0, plan.w), gr.float(0, plan.h), r, 0, Math.PI * 2); ctx.fill();
  }
  // built-up ground
  const g = ctx.createRadialGradient(plan.plaza.x, plan.plaza.y, 1, plan.plaza.x, plan.plaza.y, plan.rx * 1.15);
  g.addColorStop(0, 'rgba(120,100,70,0.35)'); g.addColorStop(1, 'rgba(120,100,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, plan.w, plan.h);
  // fields
  for (const f of plan.fields) {
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    ctx.fillStyle = f.col; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.strokeStyle = 'rgba(70,50,20,0.25)'; ctx.lineWidth = 0.05;
    for (let y = -f.h / 2 + 0.3; y < f.h / 2; y += 0.3) { ctx.beginPath(); ctx.moveTo(-f.w / 2, y); ctx.lineTo(f.w / 2, y); ctx.stroke(); }
    ctx.restore();
  }
  // water, then roads over it (the bridges)
  for (const w of plan.water) {
    ctx.strokeStyle = '#2e5e7a'; ctx.lineWidth = w.width + 0.35; poly(ctx, w.pts);
    ctx.strokeStyle = '#4a8aa8'; ctx.lineWidth = w.width; poly(ctx, w.pts);
  }
  for (const st of plan.streets) {
    ctx.strokeStyle = 'rgba(40,30,20,0.4)'; ctx.lineWidth = st.width + 0.12; poly(ctx, st.pts);
    ctx.strokeStyle = plan.road; ctx.lineWidth = st.width; poly(ctx, st.pts);
  }
  // the plaza
  ctx.fillStyle = shade(plan.road, 0.15);
  ctx.beginPath(); ctx.arc(plan.plaza.x, plan.plaza.y, plan.plaza.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,30,20,0.35)'; ctx.lineWidth = 0.08; ctx.stroke();
  // a ruin lies under ash: the streets, the fields and the ground turn the grey of ash before the houses are set on it (20-god-ui.md §7.4)
  if (ruin > 0.2) {
    ctx.fillStyle = `rgba(90,86,80,${(0.85 * ruin).toFixed(2)})`;
    ctx.fillRect(0, 0, plan.w, plan.h);
  }
  // trees under the houses
  for (const t of plan.trees) tree(ctx, t, look.fate);
  // houses, back to front
  const order = plan.buildings.map((b, i) => ({ b, i })).sort((a, c) => a.b.y - c.b.y);
  for (const { b, i } of order) {
    const broken = ruin > 0 && ((i * 2654435761) >>> 0) / 4294967296 < ruin;
    building(ctx, b, broken, plan.continent);
  }
  // wall
  if (plan.wall) wallDraw(ctx, plan.wall, plan);
  centreDraw(ctx, plan.centre, plan.plaza.r, look.fate);
  if (ruin > 0.2) {
    // glassy shards of the fall on the streets (a black glass with one bright edge), and a few embers that still glow
    const sr = new Stream(planSeed(plan.id, 41));
    for (let i = 0; i < 70 * ruin; i++) {
      const x = sr.float(plan.plaza.x - plan.rx, plan.plaza.x + plan.rx), y = sr.float(plan.plaza.y - plan.ry, plan.plaza.y + plan.ry), r = sr.float(0.1, 0.28);
      ctx.fillStyle = '#12131a'; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y + r * 0.5); ctx.lineTo(x - r * 0.6, y + r * 0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,190,200,0.55)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y + r * 0.5); ctx.stroke();
    }
    for (let i = 0; i < 14 * ruin; i++) {
      const x = sr.float(plan.plaza.x - plan.rx, plan.plaza.x + plan.rx), y = sr.float(plan.plaza.y - plan.ry, plan.plaza.y + plan.ry);
      ctx.fillStyle = 'rgba(216,106,58,0.85)'; ctx.beginPath(); ctx.arc(x, y, 0.07, 0, Math.PI * 2); ctx.fill();
    }
    // rubble and scorch marks in the streets
    for (let i = 0; i < 90 * ruin; i++) {
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(30,26,22,0.35)' : 'rgba(120,110,100,0.5)';
      const x = rng.float(plan.plaza.x - plan.rx, plan.plaza.x + plan.rx), y = rng.float(plan.plaza.y - plan.ry, plan.plaza.y + plan.ry);
      ctx.fillRect(x, y, rng.float(0.1, 0.35), rng.float(0.08, 0.25));
    }
  }
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
}

function tree(ctx: CanvasRenderingContext2D, t: CityPlan['trees'][number], fate?: FateId): void {
  const f = fate ? FATE_BY_ID[fate] : undefined;
  const col = (c: string) => (f ? mix(c, f.after[0], f.tint * 0.7) : c);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(t.x + t.r * 0.3, t.y + t.r * 0.2, t.r, t.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  if (t.kind === 'dead') {
    ctx.strokeStyle = col('#3a2c20'); ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - t.r * 2); ctx.moveTo(t.x, t.y - t.r); ctx.lineTo(t.x + t.r * 0.7, t.y - t.r * 1.6); ctx.stroke();
    return;
  }
  if (t.kind === 'cactus') { ctx.fillStyle = col('#5a8a4a'); ctx.fillRect(t.x - 0.06, t.y - t.r * 1.6, 0.12, t.r * 1.6); return; }
  ctx.fillStyle = col('#4a3624'); ctx.fillRect(t.x - 0.05, t.y - t.r * 0.7, 0.1, t.r * 0.8);
  ctx.fillStyle = col(t.kind === 'jungle' ? '#1f6a34' : t.kind === 'palm' ? '#3f9a52' : '#3f8a3a');
  ctx.beginPath(); ctx.arc(t.x, t.y - t.r * 1.1, t.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col('#6ab058');
  ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 1.3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
}

function building(ctx: CanvasRenderingContext2D, b: PlanBuilding, broken: boolean, continent: string): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  const sp = b.special;
  const roof = sp && SPECIAL_COLOR[sp] ? SPECIAL_COLOR[sp] : b.roof;
  const wall = sp ? shade(roof, 0.3) : b.wall;
  // shadow to the lower right
  ctx.fillStyle = 'rgba(20,14,8,0.28)';
  ctx.beginPath(); ctx.ellipse(b.w * 0.12, b.h * 0.3, b.w * 0.62, b.h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(Math.abs(b.rot) < 0.8 || Math.abs(Math.abs(b.rot) - Math.PI) < 0.8 ? b.rot : b.rot - Math.sign(b.rot) * Math.PI);
  const lift = b.floors * 0.12;
  const bw = b.w, bh = b.h;
  if (broken) {
    // a house that fell (20-god-ui.md §7.4): the footprint of ash and rubble, three stumps of wall at different heights, the roof a black stub, soot over it
    const seed = Math.abs(Math.round(b.x * 131 + b.y * 71)) % 97;
    const j = (k: number) => ((seed * (k + 3) * 7919) % 100) / 100;
    ctx.fillStyle = '#4a4742'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = 'rgba(20,18,16,0.55)';
    ctx.beginPath(); ctx.moveTo(-bw / 2, bh / 2); ctx.lineTo(-bw * (0.5 - 0.2 * j(1)), -bh * 0.1); ctx.lineTo(-bw * 0.1, bh * 0.15); ctx.lineTo(bw * (0.1 + 0.2 * j(2)), -bh * 0.2); ctx.lineTo(bw / 2, bh / 2); ctx.closePath(); ctx.fill();
    // stumps of wall: short, uneven, the colour of the wall gone grey
    ctx.fillStyle = shade(wall, -0.2);
    const stub = (x: number, y: number, w: number, h: number) => { ctx.fillRect(x, y, w, h); ctx.fillStyle = '#16140f'; ctx.fillRect(x, y, w, h * 0.35); ctx.fillStyle = shade(wall, -0.2); };
    stub(-bw / 2, -bh / 2, bw * 0.18, bh * (0.35 + 0.4 * j(3)));
    stub(bw / 2 - bw * 0.2, -bh / 2 + bh * 0.1, bw * 0.2, bh * (0.3 + 0.4 * j(4)));
    stub(-bw * 0.1, bh / 2 - bh * 0.3, bw * 0.4, bh * 0.3);
    // the roof, a black stub where the beams burned
    ctx.fillStyle = '#0e0d0b'; ctx.beginPath(); ctx.moveTo(-bw * 0.28, -bh * 0.05); ctx.lineTo(-bw * 0.05, -bh * (0.35 + 0.2 * j(5))); ctx.lineTo(bw * 0.12, -bh * 0.05); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }
  const style = sp ? 'special' : b.style;
  switch (style) {
    case 'dome': {
      ctx.fillStyle = wall; ctx.fillRect(-bw / 2, -bh / 2 + lift, bw, bh - lift);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.ellipse(0, -bh * 0.1, bw * 0.5, bh * 0.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(-bw * 0.12, -bh * 0.3, bw * 0.15, bh * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'spire':
    case 'tower': {
      ctx.fillStyle = wall; ctx.fillRect(-bw * 0.4, -bh * 0.1, bw * 0.8, bh * 0.6);
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(-bw * 0.46, -bh * 0.1); ctx.lineTo(0, -bh * (0.7 + b.floors * 0.3)); ctx.lineTo(bw * 0.46, -bh * 0.1); ctx.closePath(); ctx.fill();
      break;
    }
    case 'hut':
    case 'tent':
    case 'aframe':
    case 'burrow':
    case 'mushroom': {
      ctx.fillStyle = roof;
      if (style === 'mushroom' || style === 'burrow') { ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.5, bh * 0.45, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = wall; ctx.fillRect(-bw * 0.28, 0, bw * 0.56, bh * 0.25); }
      else { ctx.beginPath(); ctx.moveTo(-bw * 0.5, bh * 0.4); ctx.lineTo(0, -bh * 0.6); ctx.lineTo(bw * 0.5, bh * 0.4); ctx.closePath(); ctx.fill(); ctx.fillStyle = shade(roof, -0.3); ctx.beginPath(); ctx.moveTo(0, -bh * 0.6); ctx.lineTo(bw * 0.5, bh * 0.4); ctx.lineTo(0, bh * 0.4); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'special': {
      ctx.fillStyle = wall; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = roof; ctx.fillRect(-bw / 2 - 0.08, -bh / 2 - 0.12, bw + 0.16, bh * 0.62);
      ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.lineWidth = 0.06; ctx.strokeRect(-bw / 2 - 0.08, -bh / 2 - 0.12, bw + 0.16, bh * 0.62 + 0.12);
      if (sp === 'cathedral' || sp === 'temple' || sp === 'aerie') { ctx.fillStyle = shade(roof, -0.25); ctx.beginPath(); ctx.moveTo(-bw * 0.18, -bh / 2); ctx.lineTo(0, -bh * 1.1); ctx.lineTo(bw * 0.18, -bh / 2); ctx.closePath(); ctx.fill(); }
      if (sp === 'castle' || sp === 'fortress') { ctx.fillStyle = shade(roof, -0.2); for (const sx2 of [-1, 1]) for (const sy2 of [-1, 1]) ctx.fillRect(sx2 * bw * 0.5 - 0.3, sy2 * bh * 0.5 - 0.3, 0.6, 0.6); }
      if (sp === 'arena') { ctx.fillStyle = '#d8c690'; ctx.beginPath(); ctx.ellipse(0, 0, bw * 0.4, bh * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    default: {
      // gable, brick, stone, terrace, stilt, carved, keep, adobe, boomtown, forge: a house with a ridge
      const base = style === 'stone' || style === 'keep' || style === 'carved' ? shade(wall, -0.15) : style === 'adobe' ? '#c89a68' : wall;
      ctx.fillStyle = base; ctx.fillRect(-bw / 2, -bh / 2 + lift, bw, bh - lift);
      ctx.fillStyle = style === 'stilt' ? shade(roof, -0.1) : roof;
      ctx.fillRect(-bw / 2 - 0.05, -bh / 2 - lift * 0.5, bw + 0.1, bh * 0.58);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-bw / 2 - 0.05, -bh / 2 - lift * 0.5, bw + 0.1, bh * 0.1);
      ctx.strokeStyle = 'rgba(30,20,10,0.4)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-bw / 2, -bh * 0.2); ctx.lineTo(bw / 2, -bh * 0.2); ctx.stroke();
      if (style === 'forge' && continent === 'KD') { ctx.fillStyle = '#ff7a2a'; ctx.fillRect(bw * 0.1, bh * 0.1, 0.22, 0.22); }
    }
  }
  ctx.restore();
}

function wallDraw(ctx: CanvasRenderingContext2D, w: NonNullable<CityPlan['wall']>, plan: CityPlan): void {
  const col = w.kind === 'iron' ? '#4a4e56' : w.kind === 'palisade' ? '#6a4a2c' : w.kind === 'hedge' ? '#3f7a3a' : '#9a948a';
  ctx.strokeStyle = 'rgba(20,14,8,0.5)'; ctx.lineWidth = w.kind === 'hedge' ? 0.5 : 0.62; poly(ctx, w.ring);
  ctx.strokeStyle = col; ctx.lineWidth = w.kind === 'hedge' ? 0.42 : 0.48; poly(ctx, w.ring);
  if (w.kind === 'palisade') {
    ctx.fillStyle = shade(col, 0.2);
    for (let i = 0; i < w.ring.length; i++) { const p = w.ring[i]; ctx.fillRect(p[0] - 0.05, p[1] - 0.3, 0.1, 0.4); }
  }
  // towers at the gates
  for (const g of w.gates) {
    const dx = g[0] - plan.plaza.x, dy = g[1] - plan.plaza.y, d = Math.hypot(dx, dy) || 1;
    const px = plan.plaza.x + (dx / d) * Math.hypot(dx, dy) * 0.985, py = plan.plaza.y + (dy / d) * Math.hypot(dx, dy) * 0.985;
    ctx.fillStyle = plan.road; ctx.beginPath(); ctx.arc(px, py, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(col, -0.1);
    for (const sgn of [-1, 1]) ctx.fillRect(px - 0.35 + (-dy / d) * sgn * 0.6, py - 0.35 + (dx / d) * sgn * 0.6, 0.7, 0.7);
  }
}

function centreDraw(ctx: CanvasRenderingContext2D, c: CityPlan['centre'], r: number, fate?: FateId): void {
  const { x, y } = c;
  const dead = fate !== undefined;
  const water = dead ? '#6a8a94' : '#5aa8d0';
  ctx.save();
  switch (c.kind) {
    case 'fountain': case 'lake': case 'oasis': case 'pump':
      ctx.fillStyle = '#8a8680'; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = water; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
      if (c.kind === 'oasis') { ctx.fillStyle = '#3f8a3a'; ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.5, r * 0.3, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'bonfire': case 'caldera': case 'forge': case 'abyss':
      ctx.fillStyle = '#2a2220'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dead ? '#5a5a5e' : '#ff7a2a'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dead ? '#8a8a8e' : '#ffd060'; ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    case 'gear': case 'clock': case 'arkea':
      ctx.strokeStyle = '#6a6e72'; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); ctx.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78); ctx.stroke(); }
      break;
    case 'lighthouse': case 'obelisk': case 'tower': case 'rainspire': case 'eridan':
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + r * 0.3, y + r * 0.2, r * 0.55, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.kind === 'lighthouse' ? '#f0eadc' : '#b8b0a0';
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.3); ctx.lineTo(x - r * 0.12, y - r * 1.0); ctx.lineTo(x + r * 0.12, y - r * 1.0); ctx.lineTo(x + r * 0.3, y + r * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.kind === 'lighthouse' ? '#e0b030' : '#8a8478'; ctx.fillRect(x - r * 0.14, y - r * 1.2, r * 0.28, r * 0.22);
      break;
    case 'worldtree': case 'sapling':
      ctx.fillStyle = dead ? '#8a8a66' : '#2e7a3e'; ctx.beginPath(); ctx.arc(x, y - r * 0.3, c.kind === 'worldtree' ? r * 1.1 : r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dead ? '#a8a07a' : '#6ab058'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.5, r * 0.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'pyramid': case 'crystal': case 'skynest': case 'stairgate': case 'gate': case 'council': case 'twinpalace': case 'liftmine': case 'airship': case 'statue':
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + r * 0.3, y + r * 0.25, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c.kind === 'crystal' ? '#8ad8e0' : c.kind === 'pyramid' ? '#d8b868' : c.kind === 'skynest' ? '#d8d4cc' : '#9a948a';
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y + r * 0.35); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.6, y + r * 0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x + r * 0.6, y + r * 0.35); ctx.lineTo(x, y + r * 0.35); ctx.closePath(); ctx.fill();
      break;
    default:
      ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** The colour the plan uses for lights at night (a warm yellow), as CSS. */
export const lampColor = css(rgb('#ffd88a'), 0.9);

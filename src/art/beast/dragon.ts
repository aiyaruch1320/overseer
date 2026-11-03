// Dragons: the five dragons of the monster table (wyvern, fire, ice, ash drake, wyrmling) and the fifteen legendary ones (03-dragons.md ค่า UI:
// size, shape, scale colour, second colour, eye, effect, ambient). The shape word picks a body: western (four legs, a long neck), wyvern (two
// legs, the wings are the arms), serpentine (a long body that winds), or the earth bodies (turtle, hill, sleeper, mountain). The parts are in
// dragon-parts.ts; the shapes in dragon-west.ts, dragon-long.ts and dragon-earth.ts. What floats around a dragon is laid over the finished frame.
import type { DragonLook, EnemyLook } from '../../core/data/types-beast-looks';
import { Paint, type Frame, type Pt } from '../paint';
import { earthShape } from './dragon-earth';
import { longShape } from './dragon-long';
import { ambient, ambOf, breath, makePal, type Pal } from './dragon-parts';
import { westShape } from './dragon-west';
import { Pen, motion, type Ctx, type Info, type Mo } from './kit';

export type BL = EnemyLook | DragonLook;
/** What a shape painter is given. */
export interface Z {
  pen: Pen; p: Paint; c: Ctx<BL>; P: Pal; L: BL; mo: Mo;
  /** 0..1: the mouth, the wings */
  open: number; flap: number; ph: number; walk: boolean; strike: number; t: number; shut: boolean; words: string[];
  alt: { main: string; second: string; eye: string } | null;
  /** pixels per design unit */
  s: number;
}
export interface Out {
  mouth?: Pt; ang?: number; breath?: 'fire' | 'ice' | 'smoke' | 'water' | 'wind' | 'lava' | 'dust' | 'spore' | 'light';
  shadow?: Info['shadow']; after?: (f: Frame, pen: Pen) => void; fade?: Info['fade'];
}
/** The design canvas of a shape (units): width, and height from the feet up. */
export interface Fit { w: number; h: number }

const FIT: Record<string, Fit> = {
  serpent: { w: 200, h: 112 }, eel: { w: 140, h: 70 }, mist: { w: 200, h: 100 }, coil: { w: 150, h: 96 },
  twohead: { w: 128, h: 96 },
  stout: { w: 124, h: 76 }, fire: { w: 124, h: 76 }, ice: { w: 124, h: 76 }, wyrmling: { w: 104, h: 66 }, skeletal: { w: 134, h: 84 }, lava: { w: 140, h: 100 },
  slender: { w: 112, h: 88 }, wyvern: { w: 112, h: 80 }, ashdrake: { w: 116, h: 80 },
  copper: { w: 130, h: 88 }, turtle: { w: 82, h: 52 }, round: { w: 120, h: 70 }, sleeper: { w: 170, h: 100 }, rock: { w: 150, h: 112 },
};

const FIT_ID: Record<string, Fit> = { dragon_04: { w: 112, h: 72 }, dragon_05: { w: 78, h: 44 } };

/** Where a dragon's idle pose reaches, in pixels at the scale `s0` (cached by dragon): every dragon is scaled to fill its frame. */
const measured = new Map<string, { left: number; right: number; top: number }>();
function reach(c: Ctx<BL>, s0: number): { left: number; right: number; top: number } {
  const have = measured.get(c.L.id);
  if (have) return have;
  const W = c.w * 3, H = c.h * 3, cx = Math.round(W / 2), foot = Math.round(H * 0.8), sp = new Paint(W, H);
  const mo = motion('idle', 0, c.L.kind === 'enemy' ? c.L.atkKind : 'lash');
  const cs: Ctx<BL> = { ...c, p: sp, w: W, h: H, foot, cx, mo, mat: (h, o) => sp.mat(h, o), pen: (s) => new Pen(sp, cx, foot, s) };
  const z = zOf(cs, new Pen(sp, cx, foot, s0), s0);
  (SHAPES[c.L.form] ?? westShape)(z);
  let x0 = W, x1 = -1, y0 = H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sp.m[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
  const r = { left: cx - x0, right: x1 - cx, top: foot - y0 };
  measured.set(c.L.id, r);
  return r;
}

function zOf(c: Ctx<BL>, pen: Pen, s: number): Z {
  const { L, mo, p } = c;
  const words: string[] = L.words;
  const translucent = words.includes('translucent');
  const A = translucent ? 0.66 : 1;
  const alt = L.kind === 'dragon' ? L.alt : null;
  const o = palOpts(L);
  const P = makePal(p, L.main, L.second, o.eye ?? L.eye, { A, ...o });
  const shut = (L.kind === 'dragon' ? L.eyeShut : false) || mo.dead;
  const open = Math.min(1, mo.open * (mo.pose === 'attack' ? 1 : 0.6) + (mo.pose === 'idle' ? 0.14 * mo.breath : 0));
  const walk = mo.pose === 'walk';
  const t = mo.pose === 'attack' ? mo.a : mo.f;
  const strike = mo.pose === 'attack' ? mo.strike : mo.pose === 'hurt' ? -0.25 : 0;
  const ph = mo.ph + (mo.pose === 'idle' ? mo.breath * 0.7 : 0);
  const flap = mo.pose === 'walk' ? [1, 0.7, 0.35, 0.7][mo.f] : mo.pose === 'attack' ? [1, 0.1, 0.55][mo.a] : mo.pose === 'idle' ? 0.74 + 0.2 * mo.breath : mo.pose === 'hurt' ? 0.9 : 0.2;
  return { pen, p, c, P, L, mo, open, flap, ph, walk, strike, t, shut, words, alt, s };
}

export function paintDragon(c: Ctx<BL>): Info {
  const { L, mo } = c;
  const form = L.form;
  const fit = FIT_ID[L.id] ?? FIT[form] ?? FIT.stout;
  const s0 = Math.min((c.w * 0.95) / fit.w, (c.foot - 5) / fit.h);
  // as wide as the frame goes, as tall as the feet row allows, centred on its own reach
  const r = reach(c, s0), k = Math.min((c.w - 9) / (r.left + r.right + 10 * s0), (c.foot - 6) / r.top);
  const s = s0 * k, cxo = Math.round(c.cx - ((r.right - r.left) * k) / 2);
  const pen = new Pen(c.p, cxo, c.foot, s).at(0, mo.bob * 0.8);
  const z = zOf(c, pen, s);
  const { t } = z;
  const out = (SHAPES[form] ?? westShape)(z);
  const amb = L.kind === 'dragon' ? ambOf(L.ambient, L.effect) : L.words.includes('flames') || L.words.includes('fire') ? 'embers' : 'none';
  const box: [number, number, number, number] = [Math.max(7, cxo - r.left * k), Math.max(7, c.foot - r.top * k - 6), Math.min(c.w - 7, cxo + r.right * k), c.foot - 2];
  const breathKind = out.breath;
  return {
    shadow: out.shadow ? { ...out.shadow, cx: cxo } : { cx: cxo, cy: c.foot, rx: (r.left + r.right) * k * 0.36, ry: Math.max(2, 1.6 * s) }, tall: false, ground: [cxo, c.foot], fade: out.fade,
    after: (f) => {
      out.after?.(f, pen);
      if (amb !== 'none') ambient(f, amb, box, L.second, L.id, t + (mo.pose === 'walk' ? 1 : 0), c.w <= 64 ? 6 : mo.pose === 'attack' ? 8 : 12);
      if (mo.a === 1 && out.mouth && breathKind && !mo.dead) {
        const mx = pen.X(out.mouth[0]), my = pen.Y(out.mouth[1]), ang = out.ang ?? 0.3;
        // a plume stays inside the frame
        const room = Math.max(10, (c.w - 3 - mx) / Math.max(0.3, Math.cos(ang)));
        breath(f, [mx, my], ang, Math.min(room, 14 + 30 * s), breathKind, L.id, t);
      }
    },
  };
}

/** The belly and horn colours a dragon wants besides the two in its row. */
function palOpts(L: BL): { belly?: string; horn?: string; mouth?: string; trim?: string; eye?: string } {
  const id = L.id;
  if (id === 'KD07-1') return { belly: '#a0582c', horn: '#34302e', mouth: '#7a1e22', trim: '#b02a1a', eye: '#f0c040' };
  if (id === 'dragon_08') return { belly: '#5a4a4c', horn: '#c8c0b0', mouth: '#3a1014' };
  if (id === 'dragon_09') return { belly: '#2a2020', horn: '#4a3a34', mouth: '#ff7a20' };
  if (id === 'dragon_02') return { belly: '#d8683a', horn: '#d8c8a0', mouth: '#ff8a28' };
  if (id === 'dragon_12') return { belly: '#c8ccd2', horn: '#6a6e76' };
  if (id === 'dragon_05') return { belly: '#a09c94', horn: '#6a6a66' };
  if (id === 'dragon_14') return { belly: '#4a5a32', horn: '#5a4028' };
  if (id === 'dragon_11') return { belly: '#8a8a4a', horn: '#6a5a3a' };
  if (id === 'dragon_01') return { belly: '#ece8e0', horn: '#b8b4aa' };
  return {};
}

type Shape = (z: Z) => Out;
const SHAPES: Record<string, Shape> = {
  serpent: longShape, eel: longShape, mist: longShape, coil: longShape, twohead: westShape,
  stout: westShape, copper: westShape, fire: westShape, ice: westShape, wyrmling: westShape, skeletal: westShape, lava: westShape, slender: westShape, wyvern: westShape, ashdrake: westShape,
  turtle: earthShape, round: earthShape, sleeper: earthShape, rock: earthShape,
};

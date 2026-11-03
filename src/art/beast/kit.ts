// The tools every beast painter shares: the frames of the size classes (21-pixel-art.md §2), a pen that draws in the units of a creature's
// own design (scaled to the target size), the motion of a pose, and the warps that make a body die (topple, melt, crumble, dissolve, sink, burst).
import { POSE_OF, type Pose } from '../anim';
import { Paint, tones, type Frame, type Pt } from '../paint';
import type { AtkKind, DieKind, SizeClass } from '../../core/data/types-beast-looks';

export const FRAMES: Record<SizeClass, { w: number; h: number; foot: number }> = {
  S: { w: 48, h: 48, foot: 44 },
  M: { w: 64, h: 64, foot: 60 },
  L: { w: 128, h: 96, foot: 92 },
  XL: { w: 256, h: 192, foot: 188 },
  XXL: { w: 320, h: 180, foot: 176 },
};
/** The tallest a body of a class may be drawn (art pixels): the frame minus the shadow and a margin. */
export const MAX_H: Record<SizeClass, number> = { S: 42, M: 56, L: 90, XL: 184, XXL: 176 };

/** The poses a beast sheet has, in row order (the timing is anim.ts's). */
export const BEAST_POSES: readonly Pose[] = ['idle', 'walk', 'attack', 'hurt', 'die'];
export const poseRow = (p: Pose): number => BEAST_POSES.indexOf(p);
export const poseN = (p: Pose): number => POSE_OF[p].n;

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** `t` of the way from colour a to colour b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return `#${hex2(x[0] + (y[0] - x[0]) * t)}${hex2(x[1] + (y[1] - x[1]) * t)}${hex2(x[2] + (y[2] - x[2]) * t)}`;
}
export const dark = (h: string, t = 0.28): string => mix(h, '#1a1830', t);
export const light = (h: string, t = 0.25): string => mix(h, '#fff4d8', t);
export const grey = (h: string, t = 0.5): string => { const [r, g, b] = rgb(h); const l = (r + g + b) / 3; return mix(h, `#${hex2(l)}${hex2(l)}${hex2(l)}`, t); };
export const toHex = ([r, g, b]: [number, number, number]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export { tones };

// ── the pen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Draws in design units: (0,0) is the middle of the feet, x grows to the right (the way it faces), y grows downward (so up is negative). */
export class Pen {
  constructor(readonly p: Paint, public ox: number, public oy: number, public s: number) {}
  X(x: number): number { return this.ox + x * this.s; }
  Y(y: number): number { return this.oy + y * this.s; }
  /** A copy moved to another origin / size (for a creature drawn many times). */
  at(dx: number, dy: number, s = this.s): Pen { return new Pen(this.p, this.X(dx), this.Y(dy), s); }
  rect(x: number, y: number, w: number, h: number, k: number): void {
    const x0 = Math.round(this.X(x)), x1 = Math.round(this.X(x + w)), y0 = Math.round(this.Y(y)), y1 = Math.round(this.Y(y + h));
    this.p.rect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), k);
  }
  /** One art pixel at a point. */
  px(x: number, y: number, k: number): void { this.p.px(this.X(x), this.Y(y), k); }
  /** A dot of one design unit (at least one pixel). */
  dot(x: number, y: number, k: number, size = 1): void { this.rect(x - size / 2, y - size / 2, size, size, k); }
  ell(cx: number, cy: number, rx: number, ry: number, k: number): void { this.p.ell(this.X(cx), this.Y(cy), Math.max(0.8, rx * this.s), Math.max(0.8, ry * this.s), k); }
  poly(pts: Pt[], k: number): void { this.p.poly(pts.map(([x, y]) => [this.X(x), this.Y(y)] as Pt), k); }
  /** A tapering capsule from a to b (radii in units): limbs, necks, tails, tentacles. */
  cap(a: Pt, b: Pt, r0: number, r1: number, k: number): void {
    const ax = this.X(a[0]), ay = this.Y(a[1]), bx = this.X(b[0]), by = this.Y(b[1]);
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = Math.max(0.75, (r0 + (r1 - r0) * t) * this.s);
      this.p.ell(ax + (bx - ax) * t, ay + (by - ay) * t, r, r, k);
    }
  }
  /** A line `w` units thick. */
  line(a: Pt, b: Pt, k: number, w = 1): void { this.cap(a, b, w / 2, w / 2, k); }
  /** A chain of capsules through points with radii (a spine). */
  chain(pts: Pt[], radii: number[], k: number): void { for (let i = 0; i + 1 < pts.length; i++) this.cap(pts[i], pts[i + 1], radii[i], radii[i + 1], k); }
}

// ── motion ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Mo {
  pose: Pose;
  f: number;
  /** the walk phase 0..2π; 0 when standing */
  ph: number;
  /** the body's rise (units, negative is up): breath and the bounce of a step */
  bob: number;
  /** forward push of the whole body (units): the attack's lunge, the hurt's recoil (negative) */
  push: number;
  /** attack: 0 winding up · 1 at the full strike · 0.4 recovering; 0 outside an attack */
  strike: number;
  /** attack frame (0 wind-up, 1 strike, 2 recover), −1 outside an attack */
  a: number;
  /** the mouth or the weapon arm is open/raised this frame, 0..1 */
  open: number;
  /** 0..1 of the death; 0 when alive */
  die: number;
  dead: boolean;
  atk: AtkKind;
  /** the white flash of a hit */
  flash: boolean;
  /** 0 or 1: the second frame of idle (a breath in) */
  breath: number;
}

export function motion(pose: Pose, f: number, atk: AtkKind): Mo {
  const m: Mo = { pose, f, ph: 0, bob: 0, push: 0, strike: 0, a: -1, open: 0, die: 0, dead: false, atk, flash: false, breath: 0 };
  if (pose === 'idle') { m.breath = f % 2; m.bob = -0.5 * m.breath; }
  else if (pose === 'walk') { m.ph = (f / 4) * Math.PI * 2; m.bob = [0, -0.8, 0, -0.8][f % 4]; }
  else if (pose === 'attack') {
    m.a = f;
    m.strike = [0, 1, 0.4][f] ?? 0;
    m.open = [0.3, 1, 0.2][f] ?? 0;
    m.push = atk === 'lunge' ? [-1.5, 4, 1][f] ?? 0 : atk === 'slam' ? [-1, 2.5, 0.5][f] ?? 0 : atk === 'lash' ? [-1, 1.5, 0][f] ?? 0 : [-1, 0, 0][f] ?? 0;
    m.bob = f === 0 ? -0.5 : 0;
  } else if (pose === 'hurt') { m.flash = f === 0; m.push = f === 0 ? -2 : -1; m.bob = f === 0 ? -0.5 : 0.3; m.open = 0.5; }
  else if (pose === 'die') { m.die = [0.34, 0.67, 1][f] ?? 1; m.dead = m.die > 0.5; m.push = -0.5 * f; }
  return m;
}

// ── the context of a painter ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Info {
  /** the ground shadow */
  shadow: { cx: number; cy: number; rx: number; ry: number };
  /** a tall body falls over at its death (quadruped and long bodies lie down instead) */
  tall?: boolean;
  /** where the body stands (for the die warps): the middle of the feet in the frame */
  ground?: Pt;
}

/** Hash of a string and a number into 0..1 (for placing things that must not change between frames). */
export function rnd(seed: string | number, i = 0): number {
  const s = `${seed}:${i}`;
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// ── death warps: act on the flat-material grid before it is shaded ─────────────────────────────────────────────────────────────────────
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function remap(p: Paint, map: (x: number, y: number) => Pt | null): void {
  const old = p.m.slice();
  p.m.fill(0);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const s = map(x, y);
      if (!s) continue;
      const sx = Math.round(s[0]), sy = Math.round(s[1]);
      if (sx >= 0 && sy >= 0 && sx < p.w && sy < p.h) p.m[y * p.w + x] = old[sy * p.w + sx];
    }
}

export function applyDie(p: Paint, kind: DieKind, prog: number, ground: Pt, height: number, tall: boolean, ember: number, seed: string): void {
  const [gx, gy] = ground;
  const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
  const jitter = (x: number, y: number) => rnd(seed, x * 977 + y);
  if (kind === 'topple') {
    if (tall) {
      // a quarter turn about the feet, in three steps (the last lies flat)
      const a = (prog * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
      remap(p, (x, y) => { const dx = x - gx, dy = y - gy; return [gx + dx * c + dy * s, gy - dx * s + dy * c]; });
    } else {
      // a long body drops and lies on its side
      const k = 1 - 0.5 * prog;
      remap(p, (x, y) => [x - (prog > 0.9 ? 0 : 0), gy - (gy - y) / k]);
    }
  } else if (kind === 'melt') {
    const ky = 1 - 0.82 * prog, kx = 1 + 0.7 * prog;
    remap(p, (x, y) => [gx + (x - gx) / kx, gy - (gy - y) / ky]);
  } else if (kind === 'crumble') {
    const ky = 1 - 0.78 * prog, kx = 1 + 0.3 * prog;
    remap(p, (x, y) => (jitter(x, y) > 1 - prog * 0.35 ? null : [gx + (x - gx) / kx, gy - (gy - y) / ky]));
  } else if (kind === 'dissolve') {
    remap(p, (x, y) => {
      const up = (gy - y) / Math.max(1, height);
      if (bayer(x, y) * 0.7 + (1 - up) * 0.3 < prog * 1.05 - 0.05) return null;
      return [x, y + prog * 5];
    });
  } else if (kind === 'sink') {
    const d = prog * height * 0.85;
    remap(p, (x, y) => (y > gy + 1 ? null : [x, y - d]));
  } else if (kind === 'burst') {
    const k = 1 - 0.6 * prog;
    remap(p, (x, y) => (bayer(x, y) < prog * 0.7 ? null : [gx + (x - gx) / k, gy - (gy - y) / k]));
    if (ember) for (let i = 0; i < 6 + prog * 10; i++) p.px(gx + (rnd(seed, i) - 0.5) * height * (0.5 + prog), gy - rnd(seed, i + 40) * height * 0.5 * (1.2 - prog * 0.6), ember);
  } else {
    // sag: does not die; it sinks and settles
    const k = 1 - 0.18 * prog;
    remap(p, (x, y) => [x, gy - (gy - y) / k - prog * 2]);
  }
}

/** A white flash over a finished frame (a hit: 21-pixel-art.md §3). */
export function flash(f: Frame, t = 0.78): Frame {
  const d = new Uint8ClampedArray(f.data);
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] += (255 - d[i]) * t; d[i + 1] += (255 - d[i + 1]) * t; d[i + 2] += (255 - d[i + 2]) * t; }
  return { w: f.w, h: f.h, data: d };
}

/** `src` laid over `dst` at (dx, dy), normal alpha blending (the swarm and the riders). */
export function over(dst: Frame, src: Frame, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const yy = y + dy;
    if (yy < 0 || yy >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const xx = x + dx;
      if (xx < 0 || xx >= dst.w) continue;
      const si = (y * src.w + x) * 4, di = (yy * dst.w + xx) * 4, a = src.data[si + 3] / 255;
      if (!a) continue;
      const da = dst.data[di + 3] / 255, oa = a + da * (1 - a);
      for (let c = 0; c < 3; c++) dst.data[di + c] = (src.data[si + c] * a + dst.data[di + c] * da * (1 - a)) / oa;
      dst.data[di + 3] = oa * 255;
    }
  }
}

export const blank = (w: number, h: number): Frame => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });

// ── the context a painter is given ──────────────────────────────────────────────────────────────────────────────────────────────────
import type { MatOpts } from '../paint';
export interface Ctx<L> {
  L: L;
  p: Paint;
  /** frame size and the row the feet stand on */
  w: number;
  h: number;
  foot: number;
  /** the column the body is centred on */
  cx: number;
  mo: Mo;
  /** the target height of the body in art pixels (scale × 28, kept inside the frame) */
  px: number;
  mat: (hex: string, o?: MatOpts) => number;
  /** a pen at the middle of the feet, `s` pixels per design unit */
  pen: (s: number) => Pen;
}

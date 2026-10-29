// Shared pieces of the vector painter: the frame geometry, colour maths, the Look a person is drawn from and small drawing helpers.
import type { Stage } from './themes';

/** One frame is 56 x 92 "units"; a unit is a third of a city pixel, so an adult is about 56 units (19 px) tall at the street scale. */
export const FW = 56, FH = 92, FOOT = 86, CX = 28;
export const UNIT = 1 / 3; // city pixels per unit

export interface Look {
  race: string; role: string; skin: number; hair: number; hairStyle: number; beard: number; eye: number; mark: number;
  build: number; tall: boolean; outfit: string; cloth: number; cloth2: number; pattern: number; hat: string; tool: string;
  child: boolean; elder: boolean; fem: boolean;
  /** life stage when it is finer than child/adult/elder (teen, infant) */
  stage?: Stage;
  /** sub-line of the people (docs/races/README.md: สายเลือดย่อย), a key of the race theme's `lines` */
  line?: string;
  /** a signature colour that tints jewellery, trim and glow */
  accent?: number;
  /** extra painter features for a special person (e.g. 'halo', 'scar', 'monocle') */
  extra?: string[];
  /** a special person's own idle loop (frames) */
  sig?: number[];
  special?: string;
  /** how worn the clothes are 0..1, used by the oldest stage and by rags */
  wear?: number;
}

export const stageOfLook = (L: Look): Stage => L.stage || (L.child ? 'child' : L.elder ? 'elder' : 'adult');

export const hex = (c: number) => '#' + (c >>> 0).toString(16).padStart(6, '0');
export const rgba = (c: number, a: number) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
export function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t), g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t), bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
export const shade = (c: number, f: number) => mix(c, 0x120c1e, 1 - f); // f < 1 darkens toward a deep violet (keeps shadows warm-cool, never grey)
export const lite = (c: number, t: number) => mix(c, 0xfff6e8, t);
export const INK = 0x1b1626;
export const lineOf = (c: number) => mix(c, INK, 0.62);

/** everything one frame is painted from */
export interface Cx {
  c: CanvasRenderingContext2D;
  L: Look;
  stage: Stage;
  feats: Set<string>;
  P: import('./pose').Pose;
  frame: number;
  // geometry (in units)
  sz: number; hs: number; wide: number;
  legLen: number; torsoLen: number; armLen: number;
  hipY: number; shY: number; headX: number; headY: number; headW: number; headH: number;
  sw: number; ww: number;
  hf: number; // the head group is drawn in design units (10.6 x 9.6) then scaled by this, so a head is about a fifth of a person's height
  sh: [number, number][]; // shoulder anchors L, R
  hp: [number, number][]; // hip anchors
  hand: [number, number][]; // hand positions L, R
  foot: [number, number][];
  fx: number; // the face looks a little toward the side the person faces
  skin: number; hair: number; accent: number; accent2: number;
  skinD: number; skinL: number;
  theme: import('./themes').RaceTheme;
}

// ---- small drawing helpers (all in units) ----
export function fillPath(c: CanvasRenderingContext2D, fill: string | CanvasGradient, line?: string, lw = 0.8) {
  c.fillStyle = fill; c.fill();
  if (line) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
export function ell(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, line?: string, lw = 0.8, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2); fillPath(c, fill, line, lw);
}
export function poly(c: CanvasRenderingContext2D, pts: number[], fill: string | CanvasGradient | null, line?: string, lw = 0.8, close = true) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (line) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
export function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, line?: string, lw = 0.8) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
  fillPath(c, fill, line, lw);
}
export function stroke(c: CanvasRenderingContext2D, col: string, w: number, ...pts: number[]) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}
export function curve(c: CanvasRenderingContext2D, col: string, w: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke();
}
export function lin(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, ...stops: [number, string][]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
export function rad(c: CanvasRenderingContext2D, x: number, y: number, r: number, ...stops: [number, string][]) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}
/** a soft glow of a colour (for lava, souls, magic) */
export function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: number, a = 0.6) {
  c.fillStyle = rad(c, x, y, r, [0, rgba(col, a)], [0.5, rgba(col, a * 0.35)], [1, rgba(col, 0)]);
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
/** two-bone IK: the joint (elbow, knee) between a root and a target, bent toward `side` (-1 left, +1 right) */
export function ik(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, side: number): [number, number] {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.05, minD = Math.abs(l1 - l2) + 0.05;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
  if (d < minD) d = minD;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  const mx = ax + ux * a, my = ay + uy * a;
  const k1: [number, number] = [mx - uy * h, my + ux * h], k2: [number, number] = [mx + uy * h, my - ux * h];
  return (k1[0] - ax) * side >= (k2[0] - ax) * side ? k1 : k2;
}
/** a small seeded wobble so repeated shapes (cracks, fur) are not identical */
export const jitter = (i: number, s = 1) => (((Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1) + 1) % 1;

/** a string that is the same for two looks that paint the same */
export function lookKey(L: Look): string {
  return [L.race, L.line || '', L.outfit, L.skin, L.hair, L.hairStyle, L.beard, L.eye, L.mark, L.build, +L.tall, L.cloth, L.cloth2, L.pattern, L.hat, L.tool,
    L.stage || (L.child ? 'c' : L.elder ? 'e' : 'a'), +L.fem, L.accent ?? '', (L.extra || []).join('+'), L.role].join('_');
}


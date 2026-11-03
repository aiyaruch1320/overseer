// The parts a dragon is built from (03-dragons.md, 21-pixel-art.md §1): a body drawn as a tube along a spine (with belly plates, scale dots and a
// ridge of spikes), a head with a jaw and horns, a wing with finger bones and a scalloped membrane, legs that bend (two-bone IK), tails with a
// tip, and the things that float around a dragon, which are laid over the finished frame as light touches (no outline).
import type { Frame, Paint, Pt } from '../paint';
import { blend, dark, light, mix, ovEll, ovPuff, rnd, type Pen } from './kit';

/** The materials of one dragon. */
export interface Pal {
  body: number; bodyD: number; bodyL: number; belly: number; seam: number;
  acc: number; accD: number; accL: number; mem: number; memD: number; memL: number;
  horn: number; hornD: number; claw: number; tooth: number; ink: number; mouth: number; eye: number; glow: number; glowL: number;
}
export function makePal(p: Paint, main: string, second: string, eye: string, o: { A?: number; belly?: string; horn?: string; mouth?: string; trim?: string } = {}): Pal {
  const A = o.A ?? 1;
  const glowC = second;
  if (o.trim) second = o.trim; // the colour of the trim (membranes, ridge, accents); the row's second colour stays the glow
  const horn = o.horn ?? mix(second, '#e8dcc0', 0.55);
  return {
    body: p.mat(main, { deep: true, alpha: A }), bodyD: p.mat(dark(main, 0.32), { alpha: A }), bodyL: p.mat(light(main, 0.3), { alpha: A }),
    belly: p.mat(o.belly ?? mix(light(main, 0.32), second, 0.3), { alpha: A }), seam: p.mat(dark(main, 0.55), { flat: true, alpha: A }),
    acc: p.mat(second, { alpha: A }), accD: p.mat(dark(second, 0.3), { alpha: A }), accL: p.mat(light(second, 0.25), { alpha: A }),
    mem: p.mat(second, { alpha: Math.min(A, 0.92) }), memD: p.mat(dark(second, 0.22), { alpha: Math.min(A, 0.92) }), memL: p.mat(light(second, 0.16), { alpha: Math.min(A, 0.92) }),
    horn: p.mat(horn), hornD: p.mat(dark(horn, 0.35)), claw: p.mat(mix(horn, '#fff8e8', 0.3), { flat: true }), tooth: p.mat('#f0e8d0', { flat: true }), ink: p.mat('#14121a', { flat: true }),
    mouth: p.mat(o.mouth ?? '#7a1e22', { flat: true }), eye: p.mat(eye, { flat: true }), glow: p.mat(glowC, { flat: true }), glowL: p.mat(light(glowC, 0.5), { flat: true }),
  };
}

// ── a tube along a spine ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const tangent = (pts: Pt[], i: number): Pt => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
};
/** The unit normal that points to the belly: down (flip) or always the same side of the way the spine runs. */
export const belly = (pts: Pt[], i: number, flip = true): Pt => {
  const [tx, ty] = tangent(pts, i);
  let nx = -ty, ny = tx;
  if (flip && ny < 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
};
export interface TubeO {
  /** the outline material (a dark seam round the whole body, so overlapping parts read as parts) */
  ol?: number;
  /** belly stripe: material, from/to point index (default all), and plate seams every `plate` points */
  belly?: number; from?: number; to?: number; plate?: number; plateK?: number; bellyW?: number;
  /** scale dots */
  scale?: number; scaleD?: number; step?: number;
  /** spikes along the back: material, height, every `rstep` points, and from/to */
  ridge?: number; rh?: number; rstep?: number; rfrom?: number; rto?: number; rlean?: number;
  flip?: boolean;
  /** a line of light along the back (material) */
  edge?: number;
}
export function tube(pen: Pen, pts: Pt[], rad: number[], mat: number, o: TubeO = {}): void {
  const flip = o.flip ?? true;
  if (o.ol !== undefined) pen.chain(pts, rad.map((r) => r + 0.9), o.ol);
  pen.chain(pts, rad, mat);
  const n = pts.length;
  const i0 = o.from ?? 0, i1 = o.to ?? n - 1;
  if (o.belly !== undefined) {
    const bw = o.bellyW ?? 0.46;
    const cs: Pt[] = [], rs: number[] = [];
    for (let i = i0; i <= i1; i++) { const [nx, ny] = belly(pts, i, flip); cs.push([pts[i][0] + nx * rad[i] * (1 - bw), pts[i][1] + ny * rad[i] * (1 - bw)]); rs.push(Math.max(0.5, rad[i] * bw)); }
    pen.chain(cs, rs, o.belly);
    if (o.plate) for (let i = i0 + 1; i <= i1; i += o.plate) {
      const [nx, ny] = belly(pts, i, flip), r = rad[i];
      pen.line([pts[i][0] + nx * r * 0.12, pts[i][1] + ny * r * 0.12], [pts[i][0] + nx * r * 0.96, pts[i][1] + ny * r * 0.96], o.plateK ?? o.ol ?? o.belly, 0.8);
    }
  }
  if (o.scale !== undefined) {
    const st = o.step ?? 1;
    for (let i = i0 + 1; i < i1; i += st) {
      const [nx, ny] = belly(pts, i, flip), r = rad[i];
      const ph = i % 2 ? 0 : 0.18;
      for (const f of [-0.62 + ph, -0.2 - ph * 0.6, 0.22 + ph * 0.5]) pen.px(pts[i][0] + nx * r * f, pts[i][1] + ny * r * f, (i + (f > 0 ? 1 : 0)) % 2 && o.scaleD !== undefined ? o.scaleD : o.scale);
    }
  }
  if (o.edge !== undefined) {
    const cs: Pt[] = [], rs: number[] = [];
    for (let i = i0; i <= i1; i++) { const [nx, ny] = belly(pts, i, flip); cs.push([pts[i][0] - nx * rad[i] * 0.8, pts[i][1] - ny * rad[i] * 0.8]); rs.push(Math.max(0.5, rad[i] * 0.16)); }
    pen.chain(cs, rs, o.edge);
  }
  if (o.ridge !== undefined) {
    const h = o.rh ?? 3, st = o.rstep ?? 2;
    for (let i = o.rfrom ?? i0 + 1; i <= (o.rto ?? i1); i += st) {
      const [nx, ny] = belly(pts, i, flip), [tx, ty] = tangent(pts, i), r = rad[i], hh = h * (0.55 + 0.45 * Math.min(1, r / 5));
      const bx = pts[i][0] - nx * r * 0.85, by = pts[i][1] - ny * r * 0.85, lean = o.rlean ?? 0.5;
      pen.poly([[bx - tx * 1.5, by - ty * 1.5], [bx - nx * hh - tx * hh * lean, by - ny * hh - ty * hh * lean], [bx + tx * 1.5, by + ty * 1.5]], o.ridge);
    }
  }
}

/** `n` points of a spine: f(u) for u in 0..1. */
export const spine = (n: number, f: (u: number) => Pt): Pt[] => Array.from({ length: n + 1 }, (_, i) => f(i / n));
/** A point along a polyline at fraction u of its length. */
export function along(pts: Pt[], u: number): Pt {
  const ls = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), tot = ls.reduce((a, b) => a + b, 0);
  let d = u * tot;
  for (let i = 0; i < ls.length; i++) { if (d <= ls[i] || i === ls.length - 1) { const t = ls[i] ? Math.min(1, d / ls[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } d -= ls[i]; }
  return pts[pts.length - 1];
}

// ── a head ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface HeadO {
  sz: number; ang: number; open: number;
  style?: 'west' | 'east' | 'skull' | 'round' | 'sleep';
  horns?: 'swept' | 'antler' | 'ram' | 'stub' | 'none'; hk?: number;
  frill?: number; whisk?: number; beard?: boolean; mane?: number;
  /** eye: normal glow, white (no pupil), black, slit, hollow (a hole in the wood), none (shut or blind) */
  eye?: 'normal' | 'big' | 'shut' | 'half' | 'tear' | 'hollow' | 'blind' | 'slit';
  fangs?: boolean; teeth?: 'short' | 'long'; cheek?: boolean; pupil?: number; sway?: number;
  /** a material to draw the skull with (for a second head in other colours) */
  body?: number; bodyD?: number; bodyL?: number;
}
export function head(pen: Pen, x: number, y: number, o: HeadO, P: Pal): { mouth: Pt; eye: Pt; top: Pt } {
  const { sz, ang } = o, ca = Math.cos(ang), sa = Math.sin(ang);
  const T = (u: number, v: number): Pt => [x + (u * ca - v * sa) * sz, y + (u * sa + v * ca) * sz];
  const bm = o.body ?? P.body, bd = o.bodyD ?? P.bodyD, bl = o.bodyL ?? P.bodyL;
  const style = o.style ?? 'west', hk = o.hk ?? 1, west = style === 'west' || style === 'skull', east = style === 'east';
  const poly = (pts: Pt[], k: number) => pen.poly(pts.map(([u, v]) => T(u, v)), k);
  const chain = (pts: Pt[], rs: number[], k: number) => pen.chain(pts.map(([u, v]) => T(u, v)), rs.map((r) => r * sz), k);
  const rot = (u: number, v: number, a: number, hu: number, hv: number): [number, number] => [hu + (u - hu) * Math.cos(a) - (v - hv) * Math.sin(a), hv + (u - hu) * Math.sin(a) + (v - hv) * Math.cos(a)];
  const L = east ? 13.4 : style === 'round' || style === 'sleep' ? 9.6 : 12.2; // snout tip
  const open = o.open, ja = open * 0.62;
  const HU = 0.8, HV = 1.8;
  // far horn and the mane behind
  const horns = o.horns ?? (west || east ? 'swept' : 'none');
  const hornFar = (): void => {
    if (horns === 'none') return;
    if (horns === 'antler') chain([[-1, -2.6], [-5, -6.5 * hk], [-9, -9 * hk], [-12, -8 * hk]], [1.4, 1.1, 0.8, 0.3], P.hornD);
    else if (horns === 'ram') chain([[-1, -2.4], [-5, -5], [-7, -1], [-4, 2]], [1.8, 1.5, 1.1, 0.4], P.hornD);
    else if (horns === 'stub') chain([[-0.5, -3.2], [-2.5, -5.5 * hk]], [1.3, 0.5], P.hornD);
    else chain([[-0.5, -3.4], [-5.5, -7.2 * hk], [-10.5, -7.6 * hk], [-13.5, -4.8 * hk]], [1.6, 1.2, 0.8, 0.25], P.hornD);
  };
  hornFar();
  if (o.frill !== undefined) poly([[-1, -3.2], [-5, -8 * hk], [-8.5, -5], [-9, 0], [-6.5, 4], [-1.5, 3.5]], o.frill);
  if (o.mane !== undefined) for (let i = 0; i < 4; i++) poly([[-2 - i * 2, -3.4], [-7 - i * 2.6, -4.6 + i * 1.6], [-3 - i * 2.4, -1.4 + i * 0.9]], o.mane);
  if (o.beard) poly([[3, 3], [4, 8 + Math.sin((o.sway ?? 0)) * 0.8], [8.5, 3.6]], P.accD);
  // lower jaw (hinged), the inside of the mouth
  const jawPts: [number, number][] = style === 'round' || style === 'sleep' ? [[0.6, 1.4], [7.6, 1.8], [7.2, 3.6], [1.5, 4.2], [-1, 3]] : east ? [[0.5, 1.2], [11, 1.5], [11.4, 3], [9, 3.9], [1.5, 4.1], [-1, 3]] : [[0.5, 1.2], [10, 1.6], [10.4, 3], [8.6, 3.9], [1.5, 4.1], [-1, 3]];
  if (open > 0.15) poly([[1, 1.2], [L - 1.4, 1.2], rot(L - 1.8, 1.6, ja, HU, HV), rot(1, 1.4, ja, HU, HV)], P.mouth);
  poly(jawPts.map(([u, v]) => rot(u, v, ja, HU, HV)), bd);
  // lower teeth
  const lowT = o.teeth === 'long' ? 2.6 : 1.5;
  if (west && (o.fangs || open > 0.3 || o.teeth)) for (const u of [3.6, 6.2, 8.6]) { const a = rot(u, 1.7, ja, HU, HV), b = rot(u + 0.9, 1.7, ja, HU, HV), c = rot(u + 0.45, 1.7 - lowT, ja, HU, HV); poly([a, b, c], P.tooth); }
  // skull, snout
  pen.ell(...T(0, -0.2), 4.7 * sz, 4 * sz, bm);
  if (style === 'round' || style === 'sleep') { poly([[1, -3], [6, -2.6], [L - 1.4, -0.8], [L, 1], [6, 2], [1, 2.4]], bm); pen.ell(...T(6.6, 0.4), 3.7 * sz, 2.9 * sz, bm); }
  else if (east) { poly([[1.5, -2.8], [8, -3], [L - 1.2, -2.2], [L, -0.2], [L - 1.2, 1.6], [8, 2], [1, 2.4]], bm); pen.ell(...T(L - 2, -1.4), 2.7 * sz, 2 * sz, bm); }
  else poly([[1, -3.1], [7.5, -2.9], [L - 0.4, -1.5], [L, 0.5], [L - 1.6, 1.9], [1, 2.3]], bm);
  // light along the snout top, a cheek shadow
  poly([[2.4, -3], [L - 3, -2.6], [L - 3, -1.8], [2.4, -2]], bl);
  if (style === 'skull') { pen.ell(...T(2.2, 1.2), 2.4 * sz, 1.6 * sz, P.seam); }
  else poly([[-1, 0.8], [2.4, 1.2], [3, 2.6], [0, 2.8]], bd);
  // upper fangs
  if (west && (o.fangs || open > 0.3 || o.teeth)) {
    const fl = o.teeth === 'long' ? 3.8 : o.fangs ? 3 : 2.1;
    for (const u of [4.6, 7.6, L - 1.6]) poly([[u - 0.7, 1.8], [u + 0.8, 1.8], [u + 0.1, 1.8 + fl * (u > 6 ? 1 : 0.7)]], P.tooth);
  }
  if (east && open > 0.3) for (const u of [8, 10.6]) poly([[u - 0.6, 1.6], [u + 0.7, 1.6], [u, 3.4]], P.tooth);
  // nostril, brow
  pen.dot(...T(L - 1.1, east ? -1.3 : -0.4), P.ink, 1.4 * sz);
  poly([[0.2, -3.9], [6.4, -3.2], [6.6, -2.2], [0.4, -2.4]], style === 'skull' ? P.bodyL : bd);
  // eye
  const eye = T(3.3, -1.2);
  const ek = o.eye ?? 'normal';
  if (ek === 'shut' || ek === 'blind') { pen.line(T(2, -1), T(4.8, -0.9), P.ink, 1); }
  else if (ek === 'hollow') { pen.ell(eye[0], eye[1], 2.3 * sz, 1.8 * sz, P.ink); pen.ell(eye[0] + 0.3, eye[1], 1.4 * sz, 1.1 * sz, P.eye); }
  else {
    const big = ek === 'big' ? 1.35 : 1;
    pen.ell(eye[0], eye[1], 1.9 * sz * big, 1.45 * sz * big, P.ink);
    pen.ell(eye[0] + 0.15, eye[1], 1.25 * sz * big, 0.95 * sz * big, P.eye);
    if (ek === 'normal' || ek === 'tear' || ek === 'big') { const pk = o.pupil; if (pk !== undefined) pen.dot(eye[0] + 0.5, eye[1], pk, 1.1 * sz * big); }
    if (ek === 'slit') pen.rect(eye[0] - 0.2, eye[1] - 1, 1, 2, P.ink);
    if (ek === 'half') pen.rect(eye[0] - 1.8 * sz, eye[1] - 1.6 * sz, 3.8 * sz, 1.2 * sz + 0.4, bm);
    if (ek === 'tear') { pen.line([eye[0] + 0.4, eye[1] + 1.4], [eye[0] + 0.2, eye[1] + 4.6], P.glowL, 0.8); pen.dot(eye[0], eye[1] + 5.6, P.glowL, 1.2); }
  }
  if (!(style === 'skull') && ek !== 'shut' && ek !== 'blind') pen.line(T(1.2, -2.9), T(4.8, -2.6), bd, 0.9);
  // the near horn and the cheek spike
  const hornNear = (): void => {
    if (horns === 'none') return;
    if (horns === 'antler') {
      chain([[-1.4, -2.8], [-4.5, -6 * hk], [-8, -8.4 * hk], [-11.5, -7.6 * hk]], [1.5, 1.2, 0.9, 0.3], P.horn);
      chain([[-6, -7 * hk], [-7.2, -10.6 * hk]], [0.8, 0.25], P.horn);
      chain([[-9, -8 * hk], [-10.2, -11.4 * hk]], [0.7, 0.2], P.horn);
    } else if (horns === 'ram') chain([[-1.4, -2.6], [-5.6, -4.8], [-8, -0.4], [-5.4, 3]], [1.9, 1.7, 1.3, 0.5], P.horn);
    else if (horns === 'stub') chain([[0.2, -3.4], [-1.6, -6 * hk]], [1.4, 0.5], P.horn);
    else {
      chain([[0.2, -3.4], [-4.6, -7.4 * hk], [-9.6, -7.6 * hk], [-12.6, -4.4 * hk]], [1.7, 1.3, 0.9, 0.25], P.horn);
      chain([[-1, -1.6], [-6, -3.4 * hk], [-9.4, -1.6 * hk]], [1.2, 0.9, 0.2], P.horn);
    }
  };
  hornNear();
  if (o.cheek ?? west) poly([[-1.5, 1.2], [-6.5, 3.6], [-2.4, 3.6]], P.horn);
  if (o.whisk !== undefined) {
    const w = o.sway ?? 0;
    chain([[L - 2, 0.4], [L + 2.4, 3 + Math.sin(w) * 0.8], [L + 7, 2.6 + Math.sin(w + 1) * 1.2], [L + 11, 5.4 + Math.sin(w + 2) * 1.4]], [0.6, 0.5, 0.45, 0.3], o.whisk);
    chain([[L - 3, 1.4], [L, 4.6 + Math.sin(w + 1) * 0.8], [L + 4.6, 5.6 + Math.sin(w + 2) * 1.2], [L + 8, 8.6 + Math.sin(w + 3) * 1.4]], [0.55, 0.45, 0.4, 0.25], o.whisk);
  }
  return { mouth: T(L, 1.2 + open * 2), eye, top: T(0, -4) };
}

// ── a wing ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface WingO {
  span: number; up: number; mem: number; memD: number; memL: number; bone: number;
  fingers?: number; ragged?: boolean; sag?: number;
  /** where the trailing edge meets the body */
  hip: Pt;
  /** how far the wing reaches back (1 is a bat's) */
  sweep?: number; bone2?: number; ol?: number; hole?: boolean; skel?: boolean;
}
export function wing(pen: Pen, S: Pt, o: WingO): { tips: Pt[]; wrist: Pt } {
  const th = 2.3 + o.up * 2.3, sp = o.span, n = o.fingers ?? 3;
  const E: Pt = [S[0] + Math.cos(th) * sp * 0.34, S[1] + Math.sin(th) * sp * 0.34];
  const th2 = th - 0.38;
  const W: Pt = [E[0] + Math.cos(th2) * sp * 0.36, E[1] + Math.sin(th2) * sp * 0.36];
  const tips: Pt[] = [];
  const spread = 1.0 + o.up * 0.55 + (n > 3 ? 0.2 : 0);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.97 - (n === 1 ? 0 : i / (n - 1)) * spread;
    const len = sp * (0.82 - i * (0.34 / n)) * (o.ragged && i % 2 ? 0.86 : 1);
    tips.push([W[0] + Math.cos(a) * len, W[1] + Math.sin(a) * len + (o.sag ?? 0)]);
  }
  const outline: Pt[] = [S, E, W, tips[0]];
  for (let i = 0; i + 1 < n; i++) {
    const mid: Pt = [(tips[i][0] + tips[i + 1][0]) / 2, (tips[i][1] + tips[i + 1][1]) / 2];
    // the trailing edge between two fingers is a curve toward the wrist
    const pull = o.ragged ? 0.34 + 0.1 * (i % 2) : 0.24;
    outline.push([mid[0] + (W[0] - mid[0]) * pull, mid[1] + (W[1] - mid[1]) * pull], tips[i + 1]);
  }
  const hipP: Pt = o.hip;
  const lastMid: Pt = [(tips[n - 1][0] + hipP[0]) / 2, (tips[n - 1][1] + hipP[1]) / 2];
  outline.push([lastMid[0] + (W[0] - lastMid[0]) * 0.1, lastMid[1] + (W[1] - lastMid[1]) * 0.1], hipP);
  if (o.ol !== undefined) {
    // a dark rim round the membrane so a wing in front of a body stays a wing
    const c: Pt = [(S[0] + W[0] + hipP[0]) / 3, (S[1] + W[1] + hipP[1]) / 3];
    pen.poly(outline.map(([x, y]) => [x + Math.sign(x - c[0]) * 0.9, y + Math.sign(y - c[1]) * 0.9] as Pt), o.ol);
  }
  pen.poly(outline, o.mem);
  // panels: alternate shade between fingers, a lit strip next to the arm
  for (let i = 0; i + 1 < n; i++) {
    const mid: Pt = [(tips[i][0] + tips[i + 1][0]) / 2, (tips[i][1] + tips[i + 1][1]) / 2], pull = o.ragged ? 0.36 : 0.26;
    pen.poly([W, tips[i], [mid[0] + (W[0] - mid[0]) * pull, mid[1] + (W[1] - mid[1]) * pull], tips[i + 1]], i % 2 ? o.memD : o.memL);
  }
  pen.poly([S, E, W, [(W[0] + hipP[0]) / 2, (W[1] + hipP[1]) / 2 - 1], [(S[0] + hipP[0]) / 2, (S[1] + hipP[1]) / 2]], o.memL);
  if (o.hole) pen.ell((W[0] + tips[0][0]) / 2, (W[1] + tips[0][1]) / 2 + 2, 1.6, 1.1, o.bone);
  // bones
  const bk = o.bone2 ?? o.bone;
  pen.line(S, E, o.bone, 1.8); pen.line(E, W, o.bone, 1.5);
  for (const t of tips) pen.line(W, t, bk, 0.9);
  pen.dot(W[0], W[1], o.bone, 1.8);
  pen.poly([[W[0] - 0.8, W[1] - 0.6], [W[0] - 2.2, W[1] - 3.4], [W[0] + 0.6, W[1] - 0.2]], o.bone); // the thumb claw
  return { tips, wrist: W };
}

// ── legs ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Two-bone IK: the joint between a hip and a foot target (lengths a and b); dir picks the side the joint bends to. */
export function ik(hip: Pt, foot: Pt, a: number, b: number, dir: 1 | -1): Pt {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const d = Math.max(0.01, Math.min(a + b - 0.05, Math.hypot(dx, dy))), base = Math.atan2(dy, dx);
  const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  return [hip[0] + a * Math.cos(base + dir * A), hip[1] + a * Math.sin(base + dir * A)];
}
export interface LegO {
  /** the lengths of thigh and shin; the foot sits at `foot` (the ground) */
  a: number; b: number; foot: Pt; hind?: boolean; r: number; k: number; ol: number; claw: number; paw: number; toe?: number;
  /** a tighter, shorter foot (turtle) or a long one */
  scaleK?: number;
}
export function leg(pen: Pen, hip: Pt, o: LegO): void {
  const hock: Pt = o.hind ? [o.foot[0] - 1.6, o.foot[1] - o.b * 0.42] : [o.foot[0], o.foot[1] - 0.8];
  const knee = o.hind ? ik(hip, hock, o.a, o.b * 0.62, 1) : ik(hip, hock, o.a, o.b, -1);
  const pts: Pt[] = o.hind ? [hip, knee, hock, o.foot] : [hip, knee, hock];
  const rs = o.hind ? [o.r * 1.25, o.r, o.r * 0.7, o.r * 0.62] : [o.r * 1.15, o.r * 0.9, o.r * 0.72];
  pen.chain(pts, rs.map((r) => r + 0.8), o.ol);
  pen.chain(pts, rs, o.k);
  paw(pen, o.foot[0], o.foot[1], o.paw, o.k, o.ol, o.claw);
}
export function paw(pen: Pen, x: number, y: number, size: number, k: number, ol: number, claw: number): void {
  pen.poly([[x - size * 0.8 - 0.8, y - size * 1.1 - 0.8], [x + size * 1.5 + 0.8, y - size * 0.7 - 0.8], [x + size * 2.2 + 0.8, y + 0.6], [x - size * 0.8 - 0.8, y + 0.6]], ol);
  pen.poly([[x - size * 0.8, y - size * 1.1], [x + size * 1.5, y - size * 0.7], [x + size * 2.2, y], [x - size * 0.8, y]], k);
  for (let i = 0; i < 3; i++) pen.poly([[x + size * (1.1 + i * 0.5) - 0.2, y - 0.6], [x + size * (1.5 + i * 0.5) + 0.7, y - 0.1], [x + size * (1.1 + i * 0.5) - 0.1, y + 0.5]], claw);
}

// ── tails ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function tailTip(pen: Pen, at: Pt, dir: Pt, kind: 'spade' | 'blade' | 'club' | 'flame' | 'fin' | 'none', P: Pal, k: number, glow?: number): void {
  const [dx, dy] = dir, nx = -dy, ny = dx;
  if (kind === 'spade') pen.poly([[at[0], at[1]], [at[0] + dx * 3 + nx * 3.4, at[1] + dy * 3 + ny * 3.4], [at[0] + dx * 7.5, at[1] + dy * 7.5], [at[0] + dx * 3 - nx * 3.4, at[1] + dy * 3 - ny * 3.4]], P.horn);
  else if (kind === 'blade') pen.poly([[at[0] + nx * 1.6, at[1] + ny * 1.6], [at[0] + dx * 8, at[1] + dy * 8], [at[0] - nx * 1.6, at[1] - ny * 1.6]], P.horn);
  else if (kind === 'club') { pen.ell(at[0] + dx * 2.5, at[1] + dy * 2.5, 3.6, 3.6, k); for (let i = 0; i < 3; i++) pen.dot(at[0] + dx * 2.5 + nx * (i - 1) * 2.8, at[1] + dy * 2.5 + ny * (i - 1) * 2.8, P.horn, 1.8); }
  else if (kind === 'flame') pen.poly([[at[0] + nx * 1.6, at[1] + ny * 1.6], [at[0] + dx * 7.5 - 0.8, at[1] + dy * 7.5 - 2.4], [at[0] - nx * 1.6, at[1] - ny * 1.6]], glow ?? P.glow);
  else if (kind === 'fin') pen.poly([[at[0], at[1]], [at[0] + dx * 7 + nx * 5, at[1] + dy * 7 + ny * 5], [at[0] + dx * 10, at[1] + dy * 10], [at[0] + dx * 7 - nx * 5, at[1] + dy * 7 - ny * 5]], P.mem);
}

// ── the things that float around a dragon: laid over the finished frame, no outline ───────────────────────────────────────────────────────
export type Amb = 'embers' | 'dust' | 'ash' | 'leaves' | 'smoke' | 'cloud' | 'mist' | 'sparks' | 'drops' | 'wind' | 'none';
export const ambOf = (word: string, effect = ''): Amb => /ถ่านร้อน/.test(word) ? 'embers' : /ฝุ่น/.test(word) ? 'dust' : /เถ้า/.test(word) ? 'ash' : /ใบไม้/.test(word) ? 'leaves' : /ควัน/.test(word) ? 'smoke' : /เมฆ/.test(word) ? 'cloud' : /หมอก/.test(word) ? 'mist' : /ลม/.test(effect) ? 'wind' : 'none';
/** Float `n` touches in the box (x0..x1, y0..y1) of the frame, by frame number `t` (they drift, so idle's two frames and the walk differ). */
export function ambient(f: Frame, kind: Amb, box: [number, number, number, number], col: string, seed: string, t: number, n: number, body?: (x: number, y: number) => boolean): void {
  const [x0, y0, x1, y1] = box, W = x1 - x0, H = y1 - y0;
  for (let i = 0; i < n; i++) {
    const rx = rnd(seed, i), ry = rnd(seed, i + 50), ph = (rnd(seed, i + 99) * 4 + t) % 4 / 4;
    let x = x0 + rx * W, y = y0 + ry * H;
    if (kind === 'embers') { y = y1 - ((ry + ph * 0.7) % 1) * H; x += Math.sin(ph * 6 + i) * 2; if (body?.(x, y)) continue; const a = 1 - ph * 0.7; blend(f, x, y, ph < 0.4 ? '#ffd870' : '#ff8a30', a); if (i % 3 === 0) blend(f, x, y - 1, '#ff6a20', a * 0.5); }
    else if (kind === 'sparks') { y = y1 - ((ry + ph * 0.6) % 1) * H; blend(f, x, y, '#ffffff', 0.9 - ph * 0.6); blend(f, x + 1, y, mix(col, '#ffffff', 0.5), 0.5 - ph * 0.3); }
    else if (kind === 'dust' || kind === 'ash') { y = y0 + ((ry + ph * 0.5) % 1) * H; x += ph * 3; if (body?.(x, y)) continue; blend(f, x, y, kind === 'ash' ? '#6a6670' : mix(col, '#c8b898', 0.5), 0.55 - ph * 0.25); if (i % 2) blend(f, x + 1, y, kind === 'ash' ? '#4a4650' : mix(col, '#a89878', 0.5), 0.4); }
    else if (kind === 'leaves') { y = y0 + ((ry + ph * 0.8) % 1) * H; x += Math.sin(ph * 6.3 + i) * 3; if (body?.(x, y)) continue; const c = i % 3 === 0 ? '#c8a040' : i % 3 === 1 ? '#8aaa44' : '#5a8a3a'; blend(f, x, y, c, 0.9); blend(f, x + 1, y + 1, mix(c, '#2a3a1a', 0.35), 0.9); }
    else if (kind === 'smoke') { y = y1 - ((ry + ph * 0.6) % 1) * H; ovEll(f, x, y, 2 + ph * 3, 1.4 + ph * 2, '#4a4650', 0.32 - ph * 0.2); }
    else if (kind === 'drops') { y = y0 + ((ry + ph) % 1) * H; blend(f, x, y, '#bfe6f4', 0.8); blend(f, x, y + 1, '#7ac0d8', 0.7); }
    else if (kind === 'wind') { y = y0 + ry * H; x = x0 + ((rx + ph * 0.5) % 1) * W; for (let k = 0; k < 6; k++) blend(f, x - k, y + Math.sin(k * 0.8 + ph * 6) * 0.9, '#ffffff', 0.55 - k * 0.07); }
    else if (kind === 'cloud') { const r = (3 + rnd(seed, i + 7) * 3.2) * Math.min(1, W / 120); const px = x0 + ((rx + ph * 0.15) % 1) * W, py = y0 + ry * H; if (!body?.(px, py)) ovPuff(f, px, py, r, mix(col, '#ffffff', 0.7), 0.5); }
    else if (kind === 'mist') { const r = (3.2 + rnd(seed, i + 7) * 3.6) * Math.min(1, W / 120); ovEll(f, x0 + ((rx + ph * 0.12) % 1) * W, y0 + ry * H, r * 1.8, r * 0.6, mix(col, '#e8f0f4', 0.55), 0.2); }
  }
}

/** A breath from `at` along `ang` for `len` pixels (clipped to the frame by the caller): a cone of overlapping blobs, hot at the root. */
export function breath(f: Frame, at: Pt, ang: number, len: number, kind: 'fire' | 'ice' | 'smoke' | 'water' | 'wind' | 'lava' | 'dust' | 'spore' | 'light', seed: string, t = 0): void {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pal: Record<string, string[]> = {
    fire: ['#fff2b0', '#ffc040', '#ff8a30', '#d84a20'], ice: ['#ffffff', '#d8f4ff', '#a8d8f0', '#78b8e0'], smoke: ['#6a6670', '#4a4650', '#34303a', '#24202a'],
    water: ['#ffffff', '#cfeefa', '#8ad0e8', '#5aa0c0'], wind: ['#ffffff', '#f0f8fc', '#d0e4f0', '#b0c8dc'], lava: ['#ffe080', '#ff9a30', '#e0562a', '#8a2a1a'],
    dust: ['#d8ccb0', '#b8a888', '#8a7a64', '#6a5c4a'], spore: ['#e8f0a0', '#b0d060', '#78a844', '#4a7a30'], light: ['#ffffff', '#f4f0d0', '#e0d8a8', '#c8c090'],
  };
  const c = pal[kind];
  const n = Math.max(6, Math.round(len / 2.2));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), d = u * len, r = 1.4 + u * (len * 0.16), wob = Math.sin(u * 9 + t * 2 + rnd(seed, i) * 3) * (1 + u * 2);
    const x = at[0] + ca * d - sa * wob, y = at[1] + sa * d + ca * wob;
    const k = Math.min(3, Math.floor(u * 3.2 + (rnd(seed, i + 20) - 0.5) * 0.9));
    ovEll(f, x, y, r * 1.15, r * 0.85, c[Math.max(0, k)], 0.88 - u * 0.25);
    if (i % 2 === 0) ovEll(f, x - ca * r * 0.5, y - sa * r * 0.5, r * 0.55, r * 0.45, c[Math.max(0, k - 1)], 0.9);
  }
}

// Dragons: the five dragons of the monster table (wyvern, fire, ice, ash drake, wyrmling) and the fifteen legendary ones (03-dragons.md ค่า UI:
// size, shape, scale colour, second colour, eye, effect, ambient). A body shape (serpent, stout, eel, slender, turtle, two-head, round,
// skeletal, lava, sleeper, rock, coil, mist) is drawn on a 100 × 60 unit canvas facing right; the shape word of the doc picks the shape, the
// words of the doc add what is drawn around it.
import type { DragonLook, EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';
import type { Paint } from '../paint';

type BL = EnemyLook | DragonLook;
interface Pal { body: number; bodyD: number; bodyL: number; acc: number; accD: number; accF: number; eye: number; tooth: number; ink: number; glow: number; ghost: number }

const W = 112, H = 56;
const WIDE = new Set(['slender', 'wyvern', 'ashdrake', 'serpent', 'twohead', 'eel', 'mist', 'coil']);

// ── parts ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
interface HeadOpt { sz: number; ang: number; open: number; snout?: number; horns?: number; shut?: boolean; fangs?: boolean; frill?: boolean; eyes?: number; blind?: boolean; round?: boolean }
function head(pen: Pen, x: number, y: number, o: HeadOpt, pal: Pal, eyeMat = pal.eye, bodyMat = pal.body): void {
  const { sz, ang } = o, ca = Math.cos(ang), sa = Math.sin(ang);
  const T = (u: number, v: number): [number, number] => [x + (u * ca - v * sa) * sz, y + (u * sa + v * ca) * sz];
  const sn = o.snout ?? 1;
  if (o.horns) {
    pen.poly([T(-1.5, -2.5), T(-8 * o.horns, -6.5 * o.horns), T(-6, -2.4), T(-2, -0.5)], pal.acc);
    if (o.horns > 1) pen.poly([T(0, -3.4), T(-5.5 * o.horns, -9.5 * o.horns), T(-3.5, -2.8)], pal.accD);
  }
  if (o.frill) pen.poly([T(-1, -3), T(-6, -7), T(-8, -2), T(-6, 3), T(-1, 3)], pal.accF);
  pen.ell(...T(0, 0), 4.4 * sz, 3.7 * sz, bodyMat);
  const jaw = o.open * 3.6;
  // lower jaw first so the snout draws over its root
  pen.poly([T(0.5, 1.4), T(8 * sn, 1.4 + jaw), T(7.4 * sn, 3.1 + jaw), T(0, 3.6)], pal.bodyD);
  pen.poly([T(1, -2.6), T(9.6 * sn, -1.5), T(10 * sn, 0.9), T(1, 2.4)], bodyMat);
  if (o.round) pen.ell(...T(6 * sn, 0.4), 3.6 * sz, 2.9 * sz, bodyMat);
  pen.dot(...T(9 * sn, -0.6), pal.ink, 1.2 * sz);
  if (o.fangs || o.open > 0.45) { pen.poly([T(6.4 * sn, 1), T(7 * sn, 3 + jaw * 0.4), T(7.8 * sn, 1)], pal.tooth); pen.poly([T(3, 1.2), T(3.5, 2.8 + jaw * 0.3), T(4.3, 1.2)], pal.tooth); }
  if (o.fangs) pen.poly([T(8.6 * sn, 1), T(8.8 * sn, 5.4 + jaw), T(9.6 * sn, 1)], pal.tooth);
  if (o.open > 0.45) pen.rect(...T(2, 1.3), 5 * sz, 1 + jaw * 0.5, pal.ink);
  const eyes = o.eyes ?? 1;
  for (let i = 0; i < eyes; i++) {
    const e = T(1.4 + i * 2.2, -1.6 + i * 0.3);
    if (o.shut) pen.rect(e[0] - 1.1 * sz, e[1] - 0.2, 2.6 * sz, 0.7, pal.ink);
    else { pen.dot(e[0], e[1], eyeMat, 1.7 * sz); pen.line(T(-0.2, -2.9), T(3.8, -2.5), pal.bodyD, 0.8 * sz); }
  }
}

/** A bat or silk wing: arm, fingers, membrane. `up` 0 (down) .. 1 (raised). */
function wing(pen: Pen, root: [number, number], span: number, up: number, mem: number, bone: number, o: { fingers?: number; ragged?: boolean; sag?: number } = {}): void {
  const a0 = -2.2 + (1 - up) * 1.9; // angle of the arm
  const elbow: [number, number] = [root[0] - Math.cos(a0 - 0.1) * span * 0.45, root[1] + Math.sin(a0 - 0.1) * span * 0.45];
  const n = o.fingers ?? 3;
  const tips: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + 0.5 + i * (0.5 + (1 - up) * 0.15) + 0.15;
    tips.push([elbow[0] - Math.cos(a - 0.4) * span * (0.65 - i * 0.07), elbow[1] + Math.sin(a - 0.4) * span * (0.65 - i * 0.07) + (o.sag ?? 0)]);
  }
  const pts: [number, number][] = [root, elbow];
  tips.forEach((t, i) => { pts.push(t); if (i + 1 < tips.length) { const m: [number, number] = [(t[0] + tips[i + 1][0]) / 2 + (o.ragged ? 1.5 - (i % 2) * 3 : 0.5), (t[1] + tips[i + 1][1]) / 2 - 3 + (o.ragged ? 2 : 0)]; pts.push(m); } });
  pts.push([root[0] - 3, root[1] + 5]);
  pen.poly(pts, mem);
  pen.line(root, elbow, bone, 1.5);
  tips.forEach((t) => pen.line(elbow, t, bone, 0.9));
}

function legs(pen: Pen, o: { x: number[]; top: number; len: number; k: number; kd: number; ph: number; walk: boolean; claw: number; thick: number }): void {
  o.x.forEach((x, i) => {
    const far = i % 2 === 0, sw = o.walk ? 2.6 * Math.sin(o.ph + i * 1.6) : 0, lift = o.walk ? Math.max(0, Math.cos(o.ph + i * 1.6)) * 1.5 : 0;
    const k = far ? o.kd : o.k;
    pen.cap([x, o.top], [x + sw, -lift - 0.6], o.thick, o.thick * 0.78, k);
    pen.rect(x + sw - 0.8, -lift - 1.4, o.thick * 1.8, 1.4, k);
    pen.rect(x + sw + o.thick * 1.2, -lift - 1.4, 1, 1.4, o.claw);
  });
}

// ── ambience: what floats around a dragon (03-dragons.md บรรยากาศลอย) ──────────────────────────────────────────────────────────────────────
function ambient(pen: Pen, p: Paint, kind: string, col: string, seed: string, t: number, n: number): void {
  const kinds: [RegExp, string, (i: number) => void][] = [];
  const dot = (i: number, m: number, size: number, rise: number) => {
    const x = -48 + rnd(seed, i) * 96, y = -4 - rnd(seed, i + 70) * 50 - ((t + rnd(seed, i + 30) * 4) % 4) * rise;
    pen.dot(x, y, m, size);
  };
  void kinds;
  if (/ถ่านร้อน|embers/.test(kind)) { const m = p.mat('#ffb040', { flat: true }); for (let i = 0; i < n; i++) dot(i, m, 1.2, 1.1); }
  else if (/ฝุ่น|เถ้า|dust|ash/.test(kind)) { const m = p.mat(mix(col, '#b8b0a0', 0.5), { flat: true, alpha: 0.7 }); for (let i = 0; i < n; i++) dot(i, m, 1.1, -0.5); }
  else if (/ใบไม้|leaf/.test(kind)) { const m = p.mat('#7a9a3a', { flat: true }), m2 = p.mat('#c8a040', { flat: true }); for (let i = 0; i < n; i++) dot(i, i % 2 ? m : m2, 1.4, -0.6); }
  else if (/ควัน/.test(kind)) { const m = p.mat('#4a4650', { flat: true, alpha: 0.55 }); for (let i = 0; i < n; i++) pen.ell(-40 + rnd(seed, i) * 80, -8 - rnd(seed, i + 9) * 40 - ((t + i) % 3) * 2, 2.2, 1.4, m); }
  else if (/เมฆ|หมอก|cloud|mist/.test(kind)) { const m = p.mat(mix(col, '#ffffff', 0.55), { flat: true, alpha: 0.5 }); for (let i = 0; i < n; i++) { const x = -46 + rnd(seed, i) * 92, y = -6 - rnd(seed, i + 5) * 48; pen.ell(x + ((t * 0.7) % 3), y, 4.5 + rnd(seed, i + 2) * 3, 1.8, m); pen.ell(x + 3, y - 1.4, 2.8, 1.4, m); } }
}

// ── the painter ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function paintDragon(c: Ctx<BL>): Info {
  const { L, mo, p } = c;
  const form = L.form;
  const words: string[] = L.words;
  const s = Math.min(c.px / H, (c.w * 0.9) / (WIDE.has(form) ? 132 : W));
  const pen = c.pen(s).at(0, mo.bob * 0.8);
  const translucent = words.includes('translucent');
  const A = translucent ? 0.62 : 1;
  const alt = L.kind === 'dragon' ? L.alt : null;
  const pal: Pal = {
    body: p.mat(L.main, { deep: true, alpha: A }), bodyD: p.mat(dark(L.main, 0.3), { alpha: A }), bodyL: p.mat(light(L.main, 0.3), { alpha: A }),
    acc: p.mat(L.second, { alpha: A }), accD: p.mat(dark(L.second, 0.3)), accF: p.mat(L.second, { alpha: translucent ? 0.5 : 0.9 }),
    eye: p.mat(L.eye, { flat: true }), tooth: p.mat('#ece4cc', { flat: true }), ink: p.mat('#14121a', { flat: true }), glow: p.mat(L.second, { flat: true }),
    ghost: p.mat(mix(L.main, '#ffffff', 0.5), { flat: true, alpha: 0.4 }),
  };
  const shut = L.kind === 'dragon' ? L.eyeShut : false, dead = mo.dead;
  const open = mo.open * (mo.pose === 'attack' ? 1 : 0.6) + (mo.pose === 'idle' ? 0.18 * mo.breath : 0);
  const walk = mo.pose === 'walk';
  const t = mo.pose === 'idle' ? mo.f : mo.pose === 'walk' ? mo.f : mo.a;
  const strike = mo.pose === 'attack' ? mo.strike : 0;
  const ph = mo.ph + (mo.pose === 'idle' ? mo.breath * 0.6 : 0);
  const flap = mo.pose === 'walk' ? [1, 0.5, 0, 0.5][mo.f] : mo.pose === 'attack' ? [0.9, 0.1, 0.5][mo.a] : mo.pose === 'idle' ? 0.3 + 0.35 * mo.breath : 0.2;
  const amb = L.kind === 'dragon' ? L.ambient : words.includes('flames') || words.includes('fire') ? 'ถ่านร้อน' : '';
  const sets = { pal, shut: shut || dead, open, ph, flap, walk, strike, t, words, L, alt };

  const fn = SHAPES[form] ?? SHAPES.stout;
  const info = fn(pen, p, c, sets);
  if (amb && amb !== 'ไม่มี') ambient(pen, p, amb, L.second, L.id, (mo.f + (mo.pose === 'walk' ? 1 : 0)) * 1, mo.pose === 'idle' || mo.pose === 'walk' ? 14 : 10);
  // the breath: a plume from the mouth at the strike
  if (mo.a === 1 && info.mouth && !dead) breath(pen, p, info.mouth, L, form);
  return { shadow: info.shadow ?? { cx: c.cx, cy: c.foot, rx: 36 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: false, ground: [c.cx, c.foot] };
}

type Sets = { pal: Pal; shut: boolean; open: number; ph: number; flap: number; walk: boolean; strike: number; t: number; words: string[]; L: BL; alt: { main: string; second: string; eye: string } | null };
type Shape = (pen: Pen, p: Paint, c: Ctx<BL>, z: Sets) => { mouth?: [number, number]; shadow?: Info['shadow'] };

function breath(pen: Pen, p: Paint, m: [number, number], L: BL, form: string): void {
  const col = form === 'ice' ? '#d8f4ff' : form === 'fire' || form === 'stout' || form === 'lava' ? '#ffb040' : mix(L.second, '#ffffff', 0.4);
  const a = p.mat(col, { flat: true }), b = p.mat(mix(col, L.second, 0.5), { flat: true });
  for (let i = 0; i < 8; i++) pen.ell(m[0] + 3 + i * 3.4, m[1] + 0.5 + i * 0.7 + (i % 2) * 0.8, 1.6 + i * 0.7, 1.2 + i * 0.6, i % 2 ? a : b);
}

/** A spine: the points of a sine-wave body from tail (u=0) to head (u=1). */
function spine(n: number, f: (u: number) => [number, number]): [number, number][] { return Array.from({ length: n + 1 }, (_, i) => f(i / n)); }

const SHAPES: Record<string, Shape> = {
  // ── long bodies (Oran-Sal, Thalassa, Niveri, the cloud-ruler)
  serpent: (pen, p, c, z) => serpentine(pen, p, c, z, 'serpent'),
  eel: (pen, p, c, z) => serpentine(pen, p, c, z, 'eel'),
  mist: (pen, p, c, z) => serpentine(pen, p, c, z, 'mist'),
  twohead: (pen, p, c, z) => twoHead(pen, p, c, z),
  coil: (pen, p, c, z) => coil(pen, p, c, z),
  // ── short heavy bodies
  stout: (pen, p, c, z) => stout(pen, p, c, z, false),
  lava: (pen, p, c, z) => stout(pen, p, c, z, true),
  fire: (pen, p, c, z) => stout(pen, p, c, z, false),
  ice: (pen, p, c, z) => stout(pen, p, c, z, false),
  wyrmling: (pen, p, c, z) => stout(pen, p, c, z, false),
  skeletal: (pen, p, c, z) => stout(pen, p, c, z, false),
  slender: (pen, p, c, z) => slender(pen, p, c, z),
  wyvern: (pen, p, c, z) => slender(pen, p, c, z),
  ashdrake: (pen, p, c, z) => slender(pen, p, c, z),
  turtle: (pen, p, c, z) => turtle(pen, p, c, z),
  round: (pen, p, c, z) => round(pen, p, c, z, false),
  sleeper: (pen, p, c, z) => round(pen, p, c, z, true),
  rock: (pen, p, c, z) => rock(pen, p, c, z),
};

function serpentine(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets, kind: 'serpent' | 'eel' | 'mist' | 'twohead'): ReturnType<Shape> {
  const { pal, ph, words } = z;
  const amp = kind === 'eel' ? 7 : kind === 'twohead' ? 6 : 9, cx0 = kind === 'twohead' ? -6 : 0;
  const rise = kind === 'eel' ? 0 : 14;
  const path = spine(22, (u) => [-48 + u * 88 + cx0, -18 - rise * u - amp * Math.sin(u * 6.4 + ph) * (0.35 + u * 0.65)]);
  const rad = path.map((_, i) => { const u = i / 22; return kind === 'eel' ? 1 + 4.6 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.62) ** 0.8 : kind === 'mist' ? 1 + 4 * Math.sin(u * Math.PI) ** 0.6 : 1 + 4.4 * Math.min(1, u * 2.2) ** 0.8 * (1 - 0.35 * Math.max(0, u - 0.7)); });
  // wings of the cloud-ruler and the two-head are behind the body
  if (words.includes('cloudwings')) cloudWings(pen, p, z, path[11]);
  if (kind === 'twohead') {
    const far = z.alt!;
    const dm = p.mat(far.main, { deep: true }), dd = p.mat(dark(far.main, 0.3));
    wing(pen, [path[13][0] + 2, path[13][1] - 3], 36, z.flap, p.mat(far.second), dd, { ragged: true });
    pen.chain(path, rad, dm);
  } else if (kind !== 'mist') {
    if (words.includes('silkwings') || words.includes('wings') && !words.includes('cloudwings')) wing(pen, [path[13][0], path[13][1] - 3], 34, z.flap, pal.accF, pal.bodyD, { fingers: 4 });
  }
  pen.chain(path, rad, kind === 'twohead' ? p.mat(z.alt!.main, { deep: true }) : pal.body);
  // belly scutes and fins
  const belly = pal.acc;
  for (let i = 3; i < 22; i += 2) { const q = path[i], r = rad[i]; pen.line([q[0] - 1.2, q[1] + r * 0.55], [q[0] + 1.2, q[1] + r * 0.55], belly, 0.9); }
  if (kind === 'eel') for (let i = 2; i < 20; i++) { const q = path[i], r = rad[i]; pen.poly([[q[0] - 1.4, q[1] - r + 0.3], [q[0] + 0.6, q[1] - r - 2.6 - (i % 2)], [q[0] + 1.8, q[1] - r + 0.3]], pal.accF); }
  if (words.includes('chipped')) for (let i = 4; i < 22; i += 3) pen.dot(path[i][0] + 0.5, path[i][1] - rad[i] + 0.3, pal.ink, 1);
  if (words.includes('manyeyes')) for (let i = 6; i < 22; i += 3) { pen.dot(path[i][0], path[i][1] - rad[i] * 0.2, pal.eye, 1.5); pen.line([path[i][0] - 2, path[i][1] + 1], [path[i][0] + 2.4, path[i][1] + 1], pal.glow, 0.6); }
  const hd = path[22], pv = path[20];
  const ang = Math.atan2(hd[1] - pv[1], hd[0] - pv[0]) * 0.6;
  const opt: HeadOpt = { sz: kind === 'mist' ? 1.25 : 1.15, ang, open: z.open, horns: kind === 'eel' ? 0 : 1, shut: z.shut, fangs: kind === 'mist' ? false : kind === 'eel', frill: kind === 'eel' || words.includes('manyeyes') };
  if (kind === 'twohead') {
    // two necks from the shoulder: the far head dark (silver, black eyes), the near one gold with white eyes
    const base = path[18];
    const far = z.alt!, fm = p.mat(far.main, { deep: true });
    const farEnd: [number, number] = [hd[0] + 4, hd[1] - 14 + Math.sin(ph + 1) * 2];
    pen.cap([base[0], base[1]], [base[0] + 4, base[1] - 7], 4.3, 3.6, fm);
    pen.cap([base[0] + 4, base[1] - 7], farEnd, 3.6, 3, fm);
    head(pen, farEnd[0] + 1, farEnd[1] - 1, { sz: 1.05, ang: -0.2, open: 0.2, horns: 1, shut: false }, { ...pal, bodyD: p.mat(dark(far.main, 0.3)), acc: p.mat(far.second), tooth: pal.tooth }, p.mat(far.eye, { flat: true }), fm);
    pen.chain(path.slice(16), rad.slice(16), pal.body);
    pen.chain(path.slice(15, 20), rad.slice(15, 20).map((r) => r * 0.9), pal.body);
    wing(pen, [path[13][0] - 1, path[13][1] - 4], 36, z.flap, pal.accF, pal.bodyD, { fingers: 4 });
  }
  head(pen, hd[0] + 3, hd[1], opt, pal);
  return { mouth: [hd[0] + 12, hd[1]], shadow: { cx: c.cx, cy: c.foot, rx: 38 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function twoHead(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets): ReturnType<Shape> {
  const { pal, ph } = z;
  const alt = z.alt!;
  const a = { m: p.mat(alt.main, { deep: true }), d: p.mat(dark(alt.main, 0.3)), mem: p.mat(alt.second), acc: p.mat(light(alt.main, 0.3)) };
  const path = spine(18, (u) => [-46 + u * 62, -14 - 4 * Math.sin(u * 5 + ph) * (1 - u * 0.5) - u * 6]);
  const rad = path.map((_, i) => 1 + 5 * Math.min(1, (i / 18) * 2) ** 0.8);
  // the dark wing is behind, the bright one in front: one wing of the sun, one of the moon
  wing(pen, [path[12][0], path[12][1] - 3], 40, Math.max(0, z.flap - 0.2), a.mem, a.d, { fingers: 4, ragged: true });
  pen.chain(path, rad, pal.body);
  for (let i = 3; i < 18; i += 2) pen.line([path[i][0] - 1.2, path[i][1] + rad[i] * 0.55], [path[i][0] + 1.2, path[i][1] + rad[i] * 0.55], a.m, 0.9);
  const S = path[18];
  // the far neck and head: silver, black eyes
  const endB: [number, number] = [S[0] + 8, S[1] - 31 + Math.sin(ph + 1) * 2];
  pen.chain([[S[0] - 3, S[1] - 1], [S[0] + 1, S[1] - 15], endB], [4.2, 3.6, 3.1], a.m);
  head(pen, endB[0] + 3, endB[1] - 1, { sz: 1.1, ang: -0.3, open: 0.25, horns: 1 }, { ...pal, body: a.m, bodyD: a.d, bodyL: a.acc, acc: a.acc }, p.mat(alt.eye, { flat: true }), a.m);
  // the near neck and head: gold, white eyes
  const endA: [number, number] = [S[0] + 21, S[1] - 17 + z.strike * 6];
  pen.chain([S, [S[0] + 10, S[1] - 6], endA], [5.2, 4.6, 3.8], pal.body);
  head(pen, endA[0] + 3, endA[1], { sz: 1.2, ang: 0.1 + z.strike * 0.3, open: z.open, horns: 1, shut: z.shut }, pal);
  wing(pen, [path[12][0] - 1, path[12][1] - 4], 42, z.flap, pal.accF, pal.bodyD, { fingers: 4 });
  pen.chain([[-46, -14], [-52, -10 + Math.sin(ph) * 2]], [1, 0.6], pal.body);
  return { mouth: [endA[0] + 15, endA[1] + 2], shadow: { cx: c.cx, cy: c.foot, rx: 36 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function cloudWings(pen: Pen, p: Paint, z: Sets, root: [number, number]): void {
  const m = p.mat(z.L.second, { alpha: 0.85, deep: true }), m2 = p.mat(light(z.L.second, 0.4), { alpha: 0.8 });
  const lift = (z.flap - 0.4) * 10;
  for (let i = 0; i < 7; i++) {
    const x = root[0] - 4 - i * 5.2, y = root[1] - 8 - i * 2.6 - lift * (0.4 + i * 0.13);
    pen.ell(x, y, 8 - i * 0.4, 4.4, i % 2 ? m : m2);
  }
  pen.ell(root[0] + 3, root[1] - 7 - lift * 0.4, 7, 4, m2);
}

function stout(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets, lava: boolean): ReturnType<Shape> {
  const { pal, ph, words, L } = z;
  const bone = words.includes('ribs'), flames = words.includes('flames') || L.form === 'fire', crystal = L.form === 'ice';
  const wings = !lava && !L.words.includes('wingless') && (words.includes('wings') || ['fire', 'ice', 'wyrmling'].includes(L.form));
  const sk = L.form === 'skeletal' || bone;
  const lowY = -22;
  const walk = z.walk;
  legs(pen, { x: [-17, -12, 12, 17], top: lowY + 5, len: 10, k: pal.body, kd: pal.bodyD, ph, walk, claw: pal.tooth, thick: sk ? 2.6 : lava ? 5.2 : 4.4 });
  // tail: thick, curling
  const tailW = Math.sin(ph) * 1.4;
  pen.chain([[-22, lowY + 1], [-33, lowY + 4], [-43, lowY - 1 + tailW], [-48, lowY - 8 + tailW]], sk ? [4, 2.4, 1.6, 0.8] : [7, 5, 3.2, 1], pal.body);
  if (wings) wing(pen, [-4, lowY - 8], 34, z.flap, pal.accF, pal.bodyD, { fingers: 3, ragged: sk });
  // body
  pen.ell(0, lowY, 24, sk ? 8.5 : lava ? 13 : 11.5, pal.body);
  pen.ell(2, lowY + (lava ? 7 : 6), 20, lava ? 4.5 : 4, pal.acc);
  pen.ell(17, lowY - 2, 10, 9.5, pal.body);
  // neck and head
  const nx = 27, ny = lowY - 7 - z.strike * 2, hx = 36 + z.strike * 6, hy = lowY - 15 + z.strike * 4 + (lava ? 5 : 0) - (z.words.includes('shut') ? 4 : 0);
  pen.cap([14, lowY - 3], [nx, ny], 8, 5.6, pal.body);
  pen.cap([nx, ny], [hx - 2, hy + 2], 5.6, 4.4, pal.body);
  // scales along the back: plates, seams, spikes
  for (let i = 0; i < 9; i++) {
    const x = -20 + i * 4.8, y = lowY - (sk ? 8.2 : lava ? 12.6 : 11.2) + (i > 6 ? 1.6 * (i - 6) : 0) + (i < 2 ? 1.6 : 0);
    if (flames) pen.poly([[x - 1.6, y + 1], [x + (i % 2 ? 0.6 : -0.2), y - 5.5 - ((z.t + i) % 3) * 1.3], [x + 1.8, y + 1]], pal.glow);
    else if (crystal) pen.poly([[x - 1.4, y + 1], [x, y - 5 - (i % 3)], [x + 1.6, y + 1]], pal.acc);
    else if (!lava) pen.poly([[x - 1.6, y + 1], [x, y - 3.4 - (i % 2)], [x + 1.6, y + 1]], pal.accD);
  }
  if (lava || flames || sk) {
    if (sk) { for (let i = 0; i < 6; i++) { pen.line([-14 + i * 4.6, lowY - 6], [-12 + i * 4.6, lowY + 3], pal.bodyL, 0.9); } pen.line([-22, lowY - 8], [20, lowY - 9.6], pal.bodyL, 0.9); }
    else for (let i = 0; i < 7; i++) { pen.line([-18 + i * 6, lowY - 11], [-16 + i * 6 + (i % 2) * 2, lowY + 4], pal.glow, 0.9); }
    if (lava) { pen.line([-6, lowY - 12], [-1, lowY - 5], pal.glow, 1.1); pen.line([12, lowY - 9], [8, lowY], pal.glow, 1.1); }
  }
  if (crystal) for (let i = 0; i < 4; i++) pen.poly([[-16 + i * 10, lowY - 3], [-14.5 + i * 10, lowY - 8.5], [-13 + i * 10, lowY - 3]], pal.bodyL);
  head(pen, hx + 3, hy, { sz: lava ? 1.55 : sk ? 1.4 : 1.35, ang: 0.12 + z.strike * 0.2, open: z.open, horns: 1.2, shut: z.shut, fangs: sk, snout: sk ? 1.2 : 1, round: lava }, pal);
  if (L.kind === 'dragon' && L.eye === '#000000') void 0;
  return { mouth: [hx + 14, hy + 2], shadow: { cx: c.cx, cy: c.foot, rx: 38 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function slender(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets): ReturnType<Shape> {
  const { pal, ph, words, L } = z;
  const pipes = words.includes('pipes'), wyv = L.form === 'wyvern' || L.form === 'ashdrake';
  const ragged = L.form === 'ashdrake';
  const base = -20;
  // two legs under a long, low body; the tail trails behind with a barb
  legs(pen, { x: [-4, 4], top: base + 4, len: 9, k: pal.body, kd: pal.bodyD, ph, walk: z.walk, claw: pal.tooth, thick: 3.2 });
  const sway = Math.sin(ph) * 2;
  const tail = spine(8, (u) => [-14 - u * 42, base + 3 + 8 * Math.sin(u * 3 + ph) * u + u * 6]);
  pen.chain(tail, tail.map((_, i) => 4.2 - i * 0.4), pal.body);
  const tl = tail[8];
  if (wyv) pen.poly([[tl[0] - 1, tl[1] - 3], [tl[0] - 6, tl[1]], [tl[0] - 1, tl[1] + 3]], pal.accD);
  // wings: huge, thin
  const silk = words.includes('silkwings');
  if (!pipes) {
    wing(pen, [-2, base - 5], silk ? 52 : 42, z.flap, silk ? p.mat(z.L.second, { alpha: 0.75 }) : pal.accF, pal.bodyD, { fingers: silk ? 5 : 3, ragged, sag: silk ? 2 : 0 });
    wing(pen.at(5, 1), [-2, base - 5], silk ? 46 : 36, Math.max(0, z.flap - 0.15), p.mat(dark(z.L.second, 0.25), { alpha: 0.9 }), pal.bodyD, { fingers: silk ? 5 : 3, ragged });
  }
  pen.ell(0, base, 17, 6.2, pal.body);
  pen.ell(0, base + 3.2, 14, 2.2, pal.acc);
  pen.ell(12, base - 3, 7, 6.4, pal.body);
  const hx = 29 + z.strike * 5, hy = base - 17 + z.strike * 6 + (z.shut ? 0 : 0);
  const neck: [number, number][] = [[12, base - 4], [17, base - 10], [22, base - 15 + Math.sin(ph) * 1.5], [hx - 3, hy + 1]];
  pen.chain(neck, [4.6, 4, 3.5, 3.2], pal.body);
  if (pipes) {
    // iron pipes driven through the body; black oil runs from them (Serene)
    const pm = p.mat('#2a2a30', { deep: true }), oil = p.mat('#101014', { flat: true });
    for (const [x, y, a] of [[-10, base - 6, -0.5], [-2, base - 7, 0.4], [8, base - 8, -0.3], [-14, base + 3, 0.7], [4, base + 4, -0.6]] as const) {
      const tip: [number, number] = [x + Math.sin(a) * 9, y - Math.cos(a) * 9];
      pen.line([x, y + 1], tip, pm, 2); pen.dot(tip[0], tip[1], pal.glow, 1.4);
      for (let i = 0; i < 3; i++) pen.dot(x + Math.sin(a) * 0.6, y + 3 + i * 3 + ((z.t * 2 + i) % 3), oil, 1.1);
    }
  }
  head(pen, hx + 2, hy, { sz: 1.15, ang: 0.15 + z.strike * 0.25, open: z.open, horns: 1, shut: z.shut, snout: 1.15 }, pal);
  return { mouth: [hx + 13, hy + 2], shadow: { cx: c.cx, cy: c.foot, rx: 30 * pen.s, ry: Math.max(2, 2.4 * pen.s * 0.5) } };
}

function turtle(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets): ReturnType<Shape> {
  const { pal, ph } = z;
  const moss = p.mat('#6a8a4a'), plate = p.mat(light(z.L.main, 0.12));
  legs(pen, { x: [-24, -14, 15, 25], top: -8, len: 8, k: pal.body, kd: pal.bodyD, ph, walk: z.walk, claw: pal.tooth, thick: 5.2 });
  pen.cap([-26, -10], [-40, -4], 5, 1.6, pal.body);
  pen.ell(0, -20, 30, 16, pal.body);
  pen.rect(-30, -14, 60, 7, pal.body);
  for (let i = 0; i < 5; i++) { const x = -20 + i * 10; pen.ell(x, -26 + Math.abs(i - 2) * 2.4, 5.6, 4.2, plate); pen.line([x - 5, -23 + Math.abs(i - 2) * 2.4], [x + 5, -23 + Math.abs(i - 2) * 2.4], pal.bodyD, 0.7); }
  for (let i = 0; i < 6; i++) pen.ell(-22 + i * 8 + (i % 2) * 2, -32 + Math.abs(i - 2.5) * 2.1, 3.2, 1.7, moss);
  const hx = 35 + z.strike * 5;
  pen.cap([22, -17], [hx - 2, -14 + z.strike * 3], 8, 6, pal.body);
  head(pen, hx + 2, -14 + z.strike * 3, { sz: 1.3, ang: 0.1, open: z.open, shut: z.shut, snout: 0.85, round: true }, pal);
  return { mouth: [hx + 12, -12], shadow: { cx: c.cx, cy: c.foot, rx: 38 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function round(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets, sleeper: boolean): ReturnType<Shape> {
  const { pal, ph, words, L } = z;
  const ry = sleeper ? 15 : 18, rx = sleeper ? 30 : 24;
  const breathe = sleeper ? z.t * 0.7 : 0;
  pen.cap([-rx + 4, -6], [-rx - 10, -10 + Math.sin(ph) * 1.5], 4, 1.4, pal.body);
  pen.ell(0, -ry + 2 - breathe * 0.4, rx, ry + breathe * 0.4, pal.body);
  pen.ell(2, -3, rx * 0.8, 3.4, pal.acc);
  // soft tufts around the edge (Eridan) or earth with grass (Andar)
  const tuft = p.mat(L.second, { deep: true });
  for (let i = 0; i < 14; i++) { const a = -Math.PI + (i / 13) * Math.PI; pen.ell(Math.cos(a) * (rx - 1.4), -ry + 2 + Math.sin(a) * (ry - 1.4), 4.4, 3.6, sleeper ? pal.body : tuft); }
  if (sleeper) {
    const g1 = p.mat('#5a8a3a'), g2 = p.mat('#8aaa4a'), fl = ['#e8d060', '#e08aa0', '#f0f0e0'].map((h) => p.mat(h, { flat: true }));
    for (let i = 0; i < 16; i++) { const x = -rx + 4 + i * 3.4, y = -ry * 1.5 + 3 + 6 * Math.abs(Math.sin(i * 0.9)) - Math.cos((i / 15) * Math.PI) * 5; pen.poly([[x - 1.3, y + 2], [x + 0.2, y - 3.4 - (i % 3)], [x + 1.6, y + 2]], i % 2 ? g1 : g2); if (i % 4 === 1) pen.dot(x + 0.2, y - 4.4, fl[i % 3], 1.5); }
    // roots wrapped by the whiskers
    const wk = p.mat(dark(L.second, 0.1), { deep: false });
    for (let k = 0; k < 2; k++) pen.chain(spine(7, (u) => [rx * 0.55 + u * 24, -4 + (k ? 5 : 0) - Math.sin(u * 5 + ph + k) * 3 + u * (k ? -1 : 2)]), Array(8).fill(0.8), wk);
  } else {
    for (let i = 0; i < 6; i++) pen.ell(-30 + i * 12, -8 - (i % 3) * 3, 5, 2, p.mat(light(L.second, 0.4), { alpha: 0.6, flat: true }));
  }
  legs(pen, { x: [-12, -6, 8, 14], top: -5, len: 5, k: pal.body, kd: pal.bodyD, ph, walk: z.walk, claw: pal.tooth, thick: sleeper ? 4 : 3.4 });
  const hx = rx - 1, hy = sleeper ? -9 : -16;
  head(pen, hx + 4, hy + (sleeper ? 2 : 0), { sz: sleeper ? 1.5 : 1.4, ang: sleeper ? 0.3 : 0, open: z.open * 0.5, shut: z.shut || sleeper, round: true, snout: 0.8, eyes: 1 }, pal);
  if (!sleeper && !z.shut) pen.dot(hx + 4.4, hy - 2.5, pal.eye, 3);
  if (sleeper && words.includes('whiskers')) for (const dy of [-1, 3]) pen.chain(spine(6, (u) => [hx + 12 + u * 10, hy + 2 + dy + Math.sin(u * 4 + ph) * 2 + u * 7]), Array(7).fill(0.7), p.mat(L.second));
  return { shadow: { cx: c.cx, cy: c.foot, rx: 34 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function rock(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets): ReturnType<Shape> {
  const { pal, L } = z;
  const stone = p.mat(L.second, { deep: true }), stoneD = p.mat(dark(L.second, 0.3)), stoneL = p.mat(light(L.second, 0.2));
  // the mountain that has swallowed it
  pen.poly([[-48, 0], [-44, -22], [-30, -38], [-12, -48], [10, -46], [28, -40], [44, -26], [48, 0]], stone);
  for (let i = 0; i < 9; i++) pen.line([-40 + rnd(L.id, i) * 78, -6 - rnd(L.id, i + 4) * 36], [-40 + rnd(L.id, i) * 78 + 4 * (i % 2 ? 1 : -1), -12 - rnd(L.id, i + 4) * 36], stoneD, 0.9);
  pen.poly([[-30, -38], [-12, -48], [-14, -40], [-24, -34]], stoneL);
  // the shoulder, the tail
  pen.ell(2, -29 + z.t * 0.4, 20, 15, pal.body);
  for (let i = 0; i < 7; i++) pen.poly([[-14 + i * 4.6, -36 + Math.abs(i - 3) * 1.5], [-12 + i * 4.6, -40 + Math.abs(i - 3) * 1.5], [-10 + i * 4.6, -36 + Math.abs(i - 3) * 1.5]], pal.bodyL);
  pen.line([-8, -30], [10, -26], pal.bodyD, 0.9); pen.line([-12, -22], [8, -18], pal.bodyD, 0.9);
  const tw = Math.sin(z.ph) * 1.4;
  pen.chain([[-34, -9], [-42, -7], [-47, -11 + tw]], [5, 3.4, 1.6], pal.body);
  // an eye in a crack, brown and slow
  pen.poly([[20, -43], [30, -34], [26, -33], [17, -40]], stoneD);
  if (!z.shut) { pen.ell(23.5, -37.5, 2.6, 1.6, pal.eye); pen.dot(23.5, -37.5, pal.ink, 1.4); } else pen.line([20, -38], [27, -36], pal.ink, 0.8);
  for (let i = 0; i < 6; i++) pen.dot(-40 + rnd(L.id, i + 20) * 80, -46 + ((z.t * 2 + i * 3) % 11) * 2.2, stoneL, 1);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 44 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

function coil(pen: Pen, p: Paint, c: Ctx<BL>, z: Sets): ReturnType<Shape> {
  const { pal, ph, words, L } = z;
  const roots = words.includes('roots'), moss = p.mat('#6a8a3a'), mossL = p.mat('#8aaa4a'), root = p.mat('#4a3622');
  const loop = (cx: number, cy: number, r: number, k: number) => { for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; pen.ell(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 0.62, 5.6, 5.6, k); } };
  const lift = Math.sin(ph) * 1.2;
  pen.chain(spine(6, (u) => [-40 + u * -6, -7 - u * 8]), [3, 3.4, 3.8, 4, 4.2, 4.4, 4.6], pal.bodyD);
  loop(-12, -12, 17, pal.bodyD);
  loop(10, -14 + lift, 16, pal.body);
  for (let i = 0; i < 12; i++) pen.dot(-28 + i * 5.4, -6 - Math.abs(Math.sin(i)) * 3, pal.accD, 1.4);
  // the neck rises from the top of the coil and the head rests on it
  const nk: [number, number][] = [[12, -26], [20, -33], [26, -37 + lift], [32, -37]];
  pen.chain(nk, [5, 4.4, 4, 3.8], pal.body);
  if (roots || words.includes('moss')) {
    for (let i = 0; i < 9; i++) { const x = -20 + i * 6; pen.line([x, -29 - (i % 3) * 2], [x + 3, -16 + (i % 2) * 6], root, 0.9); }
    for (let i = 0; i < 10; i++) pen.ell(-24 + i * 5.4, -25 - Math.abs(Math.sin(i * 1.6)) * 5, 2.6, 1.5, i % 2 ? moss : mossL);
    for (let i = 0; i < 6; i++) pen.poly([[-28 + i * 9, -30], [-26 + i * 9, -35 - (i % 2) * 2], [-24 + i * 9, -30]], i % 2 ? moss : mossL);
  } else if (L.kind === 'enemy') { for (let i = 0; i < 6; i++) pen.poly([[-18 + i * 8, -29], [-16 + i * 8, -34 - ((z.t + i) % 3) * 1.4], [-14 + i * 8, -29]], pal.glow); }
  head(pen, 35, -37, { sz: 1.3, ang: 0.15 + z.strike * 0.3, open: z.open, horns: 1, shut: z.shut, round: false, frill: roots }, pal);
  return { mouth: [47, -35], shadow: { cx: c.cx, cy: c.foot, rx: 34 * pen.s, ry: Math.max(2, 3 * pen.s * 0.5) } };
}

// Long bodies: the sand worm that comes up out of the dunes, the nine-headed hydra, the cloud serpent, the reef serpent in its coral, the
// tentacle in the fog, and the nagas (a person's body rising from a serpent's coil).
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';
import type { Paint, Pt } from '../paint';
import { head, makePal, tube } from './dragon-parts';

export function paintSerpent(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'sandworm': return sandworm(c);
    case 'hydra': return hydra(c);
    case 'cloud': return cloudSerpent(c);
    case 'reef': return reef(c);
    case 'tentacle': return tentacle(c);
    default: return naga(c);
  }
}

const spine = (n: number, f: (u: number) => [number, number]): [number, number][] => Array.from({ length: n + 1 }, (_, i) => f(i / n));

function snakeHead(pen: Pen, p: Paint, x: number, y: number, sz: number, ang: number, open: number, body: number, bodyD: number, eye: number, tongue = 0): void {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const T = (u: number, v: number): [number, number] => [x + (u * ca - v * sa) * sz, y + (u * sa + v * ca) * sz];
  const tooth = p.mat('#ece4cc', { flat: true }), ink = p.mat('#14121a', { flat: true });
  pen.poly([T(-1, 1), T(5.5, 1.2 + open * 3), T(5.2, 2.8 + open * 3), T(-1, 2.6)], bodyD);
  pen.ell(...T(0, 0), 3.2 * sz, 2.7 * sz, body);
  pen.poly([T(0, -2.3), T(6.4, -1), T(6.6, 1.2), T(0, 2)], body);
  if (open > 0.3) { pen.poly([T(5, 1.2), T(5.4, 3 + open * 2), T(6, 1.2)], tooth); pen.rect(...T(1.5, 1.2), 4, 0.7 + open, ink); }
  pen.dot(...T(1.2, -1.1), eye, 1.5 * sz);
  if (tongue && open > 0.3) pen.line(T(6, 1.8 + open), T(9.5, 2.4 + open * 1.5), tongue, 0.7);
}

// ── sand worm: only the part above the dune shows ───────────────────────────────────────────────────────────────────────────────────
function sandworm(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 62, (c.w * 0.95) / 56);
  const pen = c.pen(s);
  const sand = p.mat(L.main, { deep: true }), sandD = p.mat(dark(L.main, 0.3)), band = p.mat(L.second), mouth = p.mat(L.extra[0]?.hex ?? '#8a3a2a'), tooth = p.mat('#ece4cc', { flat: true }), dune = p.mat(mix(L.main, '#ffffff', 0.12), { alpha: 0.85 });
  const rise = mo.pose === 'attack' ? [0.62, 1, 0.8][mo.a] : mo.pose === 'idle' ? 0.34 + 0.04 * mo.breath : mo.pose === 'walk' ? 0.46 + 0.06 * Math.sin(mo.ph) : mo.pose === 'hurt' ? 0.55 : 0.6;
  const H = 60 * rise, lean = 6 + (mo.pose === 'attack' ? mo.strike * 9 : 0);
  const path = spine(14, (u) => [-4 + lean * u ** 1.7 + (mo.pose === 'idle' ? Math.sin(u * 3 + mo.f) : 0), -H * u + Math.sin(mo.ph * 2 + u * 5) * (mo.pose === 'walk' ? 0.8 : 0)]);
  const rad = path.map((_, i) => 9 - (i / 14) * 1.4 + (i < 3 ? 2.4 : 0));
  pen.chain(path, rad, sand);
  for (let i = 2; i < 15; i += 1) { const q = path[i]; pen.line([q[0] - rad[i] + 0.8, q[1]], [q[0] + rad[i] - 0.8, q[1]], i % 2 ? band : sandD, 0.9); }
  const h = path[14], ang = Math.atan2(path[14][1] - path[12][1], path[14][0] - path[12][0]);
  // the round mouth faces forward, ringed with teeth
  const mr = 7.5 + (mo.open > 0.5 ? 2 : 0), mx = h[0] + 3.5, my = h[1] - 1;
  if (!mo.dead || mo.die < 0.5) {
    pen.ell(mx, my, mr * 0.55, mr, sand);
    pen.ell(mx + 1.5, my, mr * 0.42, mr * 0.82, mouth);
    pen.ell(mx + 2.4, my, mr * 0.2, mr * 0.4, p.mat('#2a0e0a', { flat: true }));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pen.poly([[mx + 1.5 + Math.cos(a) * mr * 0.42 * 0.9, my + Math.sin(a) * mr * 0.82 * 0.9], [mx + 1.5 + Math.cos(a) * mr * 0.2, my + Math.sin(a) * mr * 0.42], [mx + 1.5 + Math.cos(a + 0.3) * mr * 0.42 * 0.9, my + Math.sin(a + 0.3) * mr * 0.82 * 0.9]], tooth); }
  }
  void ang;
  // the dune around the hole: a ring of flowing sand
  pen.ell(-1, 0, 20, 3.8, dune);
  for (let i = 0; i < 5; i++) pen.dot(-16 + i * 8 + ((mo.f + i) % 2) * 1.2, -1.5 - (i % 2) * 1.4, sand, 1.4);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 20 * s, ry: Math.max(1.6, 2 * s * 0.6) }, tall: false, ground: [c.cx, c.foot] };
}

// ── hydra: a mound, nine necks, and heads that bite together ──────────────────────────────────────────────────────────────────────────
function hydra(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 62, (c.w * 0.95) / 70);
  const pen = c.pen(s).at(mo.push * 0.4, mo.bob);
  const sk = p.mat(L.main, { deep: true }), skD = p.mat(dark(L.main, 0.3)), belly = p.mat(L.second), eye = p.mat(L.eye, { flat: true }), tongue = p.mat(L.extra[0]?.hex ?? '#8a3a8a', { flat: true });
  // body: a heavy low mound with stumpy legs and a tail
  const wl = mo.pose === 'walk' ? 2 * Math.sin(mo.ph) : 0;
  pen.cap([-9, -9], [-10 - wl, -0.8], 4.4, 3.6, skD); pen.cap([10, -9], [11 + wl, -0.8], 4.6, 3.8, sk);
  pen.chain([[-16, -12], [-27, -9], [-36, -13 + Math.sin(mo.ph) * 2]], [7, 4.4, 1.2], sk);
  pen.ell(0, -14, 19, 11, sk);
  pen.ell(1, -7.5, 15, 3.6, belly);
  for (let i = 0; i < 6; i++) pen.dot(-12 + i * 5, -20 + (i % 2), skD, 1.8);
  // nine necks; the biters are the 3 nearest the middle at the strike
  const N = 9;
  const order = [...Array(N).keys()].sort((a, b) => Math.abs(a - 4) - Math.abs(b - 4));
  for (const i of order.reverse()) {
    const k = i - 4, sway = Math.sin(mo.ph * 0.5 + i * 1.4 + (mo.pose === 'idle' ? mo.breath * 1.1 : 0)) * 3.5;
    const biting = mo.pose === 'attack' && Math.abs(k) <= 2 && i % 2 === 0;
    const reach = biting ? [0.2, 1, 0.5][mo.a] : 0;
    const baseX = k * 3.4, topX = k * 6.2 + sway + reach * 20, topY = -48 + Math.abs(k) * 3.6 - (i % 2) * 3 + reach * 18 + (mo.dead ? 14 * mo.die : 0);
    const bend = k * 2.2;
    const pts: [number, number][] = [[baseX, -20], [baseX + bend, -29 + (i % 2) * 2], [(baseX + topX) / 2 + bend * 0.6, (-20 + topY) / 2 - 2], [topX, topY]];
    pen.chain(pts, [3.6, 3, 2.6, 2.3], i % 2 ? sk : skD);
    const hd = pts[3];
    snakeHead(pen, p, hd[0] + 1, hd[1] - 1.5, 1.2, (biting ? 0.5 : -0.5) * (k < 0 ? 0.6 : 1), biting ? 0.6 + 0.4 * (mo.a === 1 ? 1 : 0) : 0, i % 2 ? sk : skD, skD, mo.dead ? skD : eye, tongue);
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 24 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: false };
}

// ── cloud serpent: it lies in the air on a bank of cloud ──────────────────────────────────────────────────────────────────────────────
function cloudSerpent(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 20, (c.w * 0.95) / 96);
  const pen = c.pen(s).at(mo.push, mo.bob - 12);
  const sk = p.mat(L.main, { deep: true }), skD = p.mat(L.second, { deep: true }), belly = p.mat(light(L.main, 0.4)), eye = p.mat(L.eye, { flat: true });
  const cloud = p.mat('#e4eaf2', { alpha: 0.82 }), cloudD = p.mat('#b8c4d4', { alpha: 0.82 });
  const strike = mo.pose === 'attack' ? mo.strike : 0;
  const path = spine(20, (u) => [-44 + u * 80 + strike * u * 8, -4 - 9 * Math.sin(u * 7 + mo.ph) * (1 - u * 0.4) - u * 6 + (mo.pose === 'idle' ? mo.breath * Math.sin(u * 4) : 0) + strike * u * 6]);
  pen.chain(path, path.map((_, i) => 0.9 + 3.6 * Math.sin(Math.min(1, (i / 20) * 1.15) * Math.PI * 0.55)), sk);
  for (let i = 3; i < 21; i += 2) { const q = path[i]; pen.line([q[0] - 1.4, q[1] + 3], [q[0] + 1.4, q[1] + 3], belly, 0.8); pen.line([q[0] - 1, q[1] - 3.2], [q[0] + 1, q[1] - 3.2], skD, 0.8); }
  for (const [x, y, r] of [[-30, 6, 7], [-12, 9, 9], [8, 8, 8], [26, 5, 7], [-42, 3, 5]] as const) { pen.ell(x, y, r + 2, 3.4, cloud); pen.ell(x + 2, y + 1.4, r, 2.6, cloudD); }
  const h = path[20], hv = path[18];
  const ang = Math.atan2(h[1] - hv[1], h[0] - hv[0]) * 0.5;
  snakeHead(pen, p, h[0] + 2, h[1], 1.7, ang, mo.open, sk, skD, mo.dead ? skD : eye);
  pen.poly([[h[0] - 1, h[1] - 3], [h[0] - 6, h[1] - 7], [h[0] - 2, h[1] - 1]], skD);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 30 * s, ry: Math.max(1.6, 2 * s * 0.5) }, tall: false, ground: [c.cx, c.foot - 12 * s] };
}

// ── reef serpent: coral-coloured rings in the coral, a yellow eye ────────────────────────────────────────────────────────────────────
function reef(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 24, (c.w * 0.94) / 90);
  const pen = c.pen(s).at(mo.push * 0.5 - 4, mo.bob);
  const P = makePal(p, L.main, L.second, L.eye, { belly: '#f0b090', horn: '#e8c8a0', mouth: '#7a2a3a' });
  const cor = [p.mat('#e86a8a', { deep: true }), p.mat('#c85a9a', { deep: true }), p.mat('#f0a070', { deep: true }), p.mat('#7a4a8a', { deep: true })], corL = p.mat('#f8c0c8');
  const strike = mo.pose === 'attack' ? mo.strike : 0, glowing = mo.pose === 'attack' && mo.a === 0;
  const coral = (x: number, h: number, k: number, d: number): void => {
    const top: Pt = [x + d * 3, -h];
    pen.chain([[x, 1], [x + d * 1.4, -h * 0.5], top], [2.4, 1.8, 1], P.seam); pen.chain([[x, 1], [x + d * 1.4, -h * 0.5], top], [1.8, 1.3, 0.6], cor[k]);
    pen.chain([[x + d * 1.4, -h * 0.5], [x - d * 3, -h * 0.9]], [1.4, 0.6], cor[(k + 1) % 4]); pen.chain([[x + d * 1.6, -h * 0.35], [x + d * 5.6, -h * 0.65]], [1.2, 0.5], cor[(k + 2) % 4]);
    pen.dot(top[0], top[1], corL, 1.4);
  };
  for (let i = 0; i < 7; i++) coral(-30 + i * 9, 14 + (i % 3) * 5, i % 4, i % 2 ? 1 : -1);
  // the body winds through the coral, banded red-orange and violet
  const body = spine(22, (u) => [-26 + u * 46, -8 - 4.4 * Math.sin(u * 13 + mo.ph) * (1 - u * 0.35) - u * 5]);
  const rad = body.map((_, i) => 1.2 + 4.8 * Math.min(1, (i / 22) * 2.6) ** 0.8);
  tube(pen, body, rad, P.body, { ol: P.seam, belly: P.belly, from: 3, plate: 2, plateK: P.seam, bellyW: 0.4 });
  for (let i = 3; i < 22; i += 3) { const q = body[i], r = rad[i]; pen.line([q[0] - 0.6, q[1] - r + 0.6], [q[0] + 0.6, q[1] + r - 0.6], glowing ? P.glowL : P.acc, 1.3); if (i % 4 === 1) pen.px(q[0] + 1, q[1] - r * 0.4, P.accL); }
  const nk = spine(7, (u) => [20 + u * 7 + strike * u * 14, -12 - u * 14 + strike * u * 10 + Math.sin(mo.ph + u * 3) * 0.8]);
  tube(pen, nk, nk.map((_, i) => 5.2 - i * 0.2), P.body, { ol: P.seam });
  const h = nk[7];
  head(pen, h[0] + 2, h[1], { sz: 1.15, ang: 0.15 + strike * 0.6, open: mo.open, style: 'east', horns: 'none', cheek: false, eye: mo.dead ? 'shut' : 'normal', pupil: P.ink }, P);
  // two small pieces of coral in front
  coral(-22, 7, 0, -1); coral(24, 8, 2, 1);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 32 * s, ry: Math.max(1.4, 1.8 * s) }, tall: false };
}

// ── tentacle: a pale arm of the fog, thickest at the root, with a curled tip ────────────────────────────────────────────────────────────
function tentacle(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 62, (c.w * 0.9) / 50);
  const pen = c.pen(s);
  const sk = p.mat(L.main, { deep: true, alpha: 0.92 }), skD = p.mat(L.second, { alpha: 0.9 }), fog = p.mat('#eef0f6', { alpha: 0.7, flat: true });
  const strike = mo.pose === 'attack' ? [0.1, 1, 0.5][mo.a] : 0;
  const sway = mo.pose === 'idle' ? mo.breath * 3 : mo.pose === 'walk' ? Math.sin(mo.ph) * 4 : 0;
  const path = spine(18, (u) => [Math.sin(u * 6 + (mo.pose === 'idle' ? mo.breath : mo.ph * 0.5)) * 8 * u + sway * u + strike * (u * 24 - 6 * u * u) , -(48 - strike * 22) * u + Math.cos(u * 3) * 2 * u + strike * 12 * u * u]);
  pen.chain(path, path.map((_, i) => 3.8 * (1 - i / 18) ** 0.8 + 0.7), sk);
  // curled tip
  const tip = path[18];
  pen.chain([tip, [tip[0] + 3, tip[1] - 2], [tip[0] + 5, tip[1] + 1], [tip[0] + 3, tip[1] + 3]], [0.9, 0.8, 0.7, 0.6], sk);
  for (let i = 3; i < 18; i += 3) pen.dot(path[i][0] + 1.4, path[i][1], skD, 1.2);
  // the bank of fog it rises from
  for (const [x, y, r] of [[-14, -1, 9], [-2, -3, 11], [12, -1, 9], [-22, -5, 6], [20, -4, 6]] as const) pen.ell(x, y - 2, r, 4.4, fog);
  if (mo.dead) void rnd;
  return { shadow: { cx: c.cx, cy: c.foot, rx: 16 * s, ry: Math.max(1.6, 1.8 * s) }, tall: false };
}

// ── naga: a person's body on a serpent's coil ──────────────────────────────────────────────────────────────────────────────────────────
function naga(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 60, (c.w * 0.9) / 58);
  const pen = c.pen(s).at(mo.push * 0.4, mo.bob);
  const sk = p.mat(L.main, { deep: true }), skD = p.mat(dark(L.main, 0.3)), acc = p.mat(L.second, { deep: true }), skin = p.mat(mix(L.second, '#d8b890', 0.5), { deep: true });
  const eye = p.mat(L.eye, { flat: true }), glow = L.words.includes('glow'), ink = p.mat('#14121a', { flat: true });
  const strike = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
  // three loops of coil, the tail swinging out behind
  const loop = (cy: number, r: number, k: number) => { for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; pen.ell(Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 0.42, 5.2, 5.2, k); } };
  loop(-6, 17, skD); loop(-14, 13, sk); loop(-21, 8.5, sk);
  const tw = Math.sin(mo.ph) * 2 + strike * 8;
  pen.chain(spine(8, (u) => [-24 - u * 22 + strike * u * 30, -5 - u * 3 + Math.sin(u * 6 + mo.ph) * 3 * u - strike * u * 6]), [5, 4.6, 4, 3.4, 2.8, 2.2, 1.6, 1, 0.6], sk);
  void tw;
  for (let i = 0; i < 7; i++) pen.line([-14 + i * 5, -16 + (i % 2) * 3], [-13 + i * 5, -12 + (i % 2) * 3], acc, 0.8);
  if (L.words.includes('eggs')) for (let i = 0; i < 4; i++) { pen.ell(-30 + i * 6.5, -3, 3.3, 3, p.mat('#e8e0c8')); pen.dot(-31 + i * 6.5, -4, p.mat('#f8f4e8', { flat: true }), 1); }
  // torso and head rise out of the coil; arms hang and move at the strike
  const lean = strike * 6, bx = 4 + lean;
  pen.cap([2, -22], [bx, -36], 6, 5, skin);
  pen.cap([bx - 4, -35], [bx - 9, -26 + strike * 10], 2.1, 1.6, skin);
  pen.cap([bx + 4, -35], [bx + 7 + strike * 12, -30 + strike * 4], 2.2, 1.7, skin);
  pen.ell(bx + 0.4, -42, 4.1, 4.4, skin);
  pen.poly([[bx - 4.4, -45], [bx - 1, -49], [bx + 4, -46], [bx + 4.4, -42], [bx - 4, -39]], acc);
  pen.poly([[bx - 2, -49], [bx - 4, -54], [bx + 0.5, -49]], acc); pen.poly([[bx + 1, -49], [bx + 3, -53], [bx + 3.6, -48]], acc);
  pen.dot(bx + 2.2, -42.4, mo.dead ? skD : eye, 1.5);
  pen.rect(bx + 1.2, -39.6, 2.6, 0.7 + mo.open * 0.5, ink);
  for (let i = 0; i < 4; i++) pen.rect(bx - 1.5 + i * 1.6, -35 + (i % 2), 1.2, 3.4, acc);
  if (glow) {
    for (let i = 0; i < 5; i++) pen.line([-22 + i * 10, -1], [-20 + i * 10, -12 - (i % 2) * 3], p.mat(L.eye, { flat: true }), 0.8);
    pen.chain(spine(6, (u) => [bx + 5 + u * 14, -35 + Math.sin(u * 5 + mo.ph) * 3 + u * 6]), Array(7).fill(1), p.mat(L.eye, { flat: true }));
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 26 * s, ry: Math.max(2, 3 * s * 0.5) }, tall: false };
}

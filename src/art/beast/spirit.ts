// Spirits and things of the elements: translucent bodies that fade at the edge, with a point of light (the eye) as the one thing that is not
// grey. The wraith, the head with its trailing gut (krasue), the crouching pop, the five-flag legion, the crowned shadow on its throne, the
// dream eater, the mirage, the bell, the rift speaker; the reactor spirit and the sand djinn.
import type { EnemyLook } from '../../core/data/types-beast-looks';
import { dark, light, mix, rnd, type Ctx, type Info, type Pen } from './kit';
import type { Paint } from '../paint';

export function paintSpirit(c: Ctx<EnemyLook>): Info {
  switch (c.L.form) {
    case 'krasue': return krasue(c);
    case 'pop': return pop(c);
    case 'legion': return legion(c);
    case 'crown': return crown(c);
    case 'dream': return dream(c);
    case 'mirage': return mirage(c);
    case 'bell': return bell(c);
    case 'rift': return rift(c);
    case 'reactor': return reactor(c);
    case 'djinn': return djinn(c);
    default: return wraith(c);
  }
}

const spine = (n: number, f: (u: number) => [number, number]): [number, number][] => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const GHOST = 0.8;

/** A hooded ghost figure leaning with `lean`, its hem trailing; used by the wraith, the legion and the mirage. */
function ghostFigure(pen: Pen, p: Paint, L: EnemyLook, x: number, y: number, o: { lean: number; trail: number; alpha: number; reach: number; tint?: string; spear?: boolean; dead?: boolean }): void {
  const col = o.tint ?? L.main;
  const body = p.mat(col, { deep: true, alpha: o.alpha }), bodyD = p.mat(dark(col, 0.3), { alpha: o.alpha }), hood = p.mat(L.second, { deep: true, alpha: o.alpha });
  const eye = p.mat(L.eye, { flat: true }), ink = p.mat('#0c0a14', { flat: true });
  const fl = o.trail;
  pen.poly([[x - 7 + o.lean, y - 20], [x + 6 + o.lean, y - 20], [x + 8, y - 3], [x + 5 + fl, y + 0.5], [x + 2, y - 2.5], [x - 1 - fl, y + 1.5], [x - 4, y - 2], [x - 9 - fl * 2, y - 0.5], [x - 8, y - 9]], body);
  for (const dx of [-5, -1, 3]) pen.line([x + dx + o.lean * 0.5, y - 15], [x + dx - fl, y - 2], bodyD, 0.9);
  pen.ell(x + 0.6 + o.lean, y - 24.5, 5.1, 5.4, hood);
  pen.ell(x + 2.2 + o.lean, y - 24, 3.3, 3.7, ink);
  if (!o.dead) { pen.dot(x + 1.4 + o.lean, y - 24.6, eye, 1.4); pen.dot(x + 3.6 + o.lean, y - 24.6, eye, 1.4); }
  // the arm reaches
  pen.cap([x + 4 + o.lean, y - 17], [x + 8 + o.reach, y - 14 - o.reach * 0.2], 1.9, 1.2, bodyD);
  for (let i = 0; i < 3; i++) pen.line([x + 8 + o.reach, y - 14 - o.reach * 0.2], [x + 11.5 + o.reach, y - 15 + i * 1.3 - o.reach * 0.2], eye, 0.6);
  if (o.spear) { pen.line([x + 7 + o.reach, y - 2], [x + 8.5 + o.reach, y - 34], p.mat('#8a8a96', { alpha: o.alpha }), 0.9); pen.poly([[x + 8.5 + o.reach, y - 37], [x + 7.4 + o.reach, y - 33], [x + 9.8 + o.reach, y - 33]], p.mat('#c8ccd4', { flat: true })); }
}

function wraith(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 30, (c.w * 0.9) / 34);
  const hover = -4 - (mo.pose === 'idle' ? mo.breath * 1.2 : 0);
  const pen = c.pen(s).at(mo.push, mo.bob + hover);
  const strike = mo.pose === 'attack' ? [0.2, 1, 0.6][mo.a] : 0;
  ghostFigure(pen, p, L, 0, 0, { lean: 2.4 + strike * 3, trail: mo.pose === 'walk' ? Math.sin(mo.ph) * 1.6 + 2 : 1.4 + mo.breath * 1.2, alpha: GHOST, reach: 1 + strike * 7, dead: mo.dead });
  // cold breath behind
  for (let i = 0; i < 5; i++) pen.dot(-9 - i * 3 - mo.f, -8 - i * 1.4 + (i % 2) * 2, p.mat(mix(L.main, '#ffffff', 0.5), { flat: true, alpha: 0.5 }), 1.4);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 6 * s, ry: Math.max(1.2, 1.2 * s) }, tall: false, ground: [c.cx, c.foot - hover * s] };
}

function krasue(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 26, (c.w * 0.9) / 30);
  const bob = Math.sin(mo.ph) * 1.5 + (mo.pose === 'idle' ? mo.breath * 1.6 : 0);
  const dive = mo.pose === 'attack' ? [0, 1, 0.5][mo.a] : 0;
  const pen = c.pen(s).at(mo.push + dive * 6, mo.bob - 16 + bob + dive * 4);
  const skin = p.mat(L.main, { deep: true }), gut = p.mat(L.second, { deep: true }), light_ = p.mat(L.eye, { flat: true, alpha: 0.9 }), hair = p.mat('#1a1620', { deep: true }), ink = p.mat('#100c14', { flat: true });
  const glow = p.mat(L.eye, { flat: true, alpha: 0.35 });
  pen.ell(0, 0, 9, 9, glow);
  // hair floats backward
  for (let i = 0; i < 6; i++) pen.cap([-1, -3 + i * 1.2], [-9 - i * 2 - mo.f * 1.2, -4 + i * 3 + Math.sin(mo.ph + i) * 2], 2, 0.7, hair);
  pen.ell(0, 0, 5.4, 5.8, skin);
  pen.poly([[-5.4, -2], [-3, -6.4], [2, -6.6], [5, -3], [2, -4.6], [-2, -4.2]], hair);
  pen.rect(0.4, -1.2, 1.8, 0.8, ink); pen.rect(3, -1.2, 1.8, 0.8, ink);
  pen.dot(1.4, -0.8, mo.dead ? ink : light_, 0.9); pen.dot(3.9, -0.8, mo.dead ? ink : light_, 0.9);
  pen.rect(1.6, 2.2, 3, 0.7, p.mat('#7a3a40', { flat: true }));
  // the gut trailing under the head, wet and red, with its knots
  for (let k = 0; k < 3; k++) {
    const pts = spine(8, (u) => [-3 + k * 2.6 - u * 3 * (k + 1) * 0.5 + Math.sin(u * 5 + mo.ph + k) * 2, 5 + u * (14 + k * 2.6)]);
    pen.chain(pts, pts.map((_, i) => 1.9 - i * 0.14), gut);
    for (let i = 2; i < 9; i += 3) pen.dot(pts[i][0], pts[i][1], p.mat(light(L.second, 0.3), { flat: true }), 1.1);
  }
  pen.ell(-1, 5.5, 3, 1.2, gut);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 5 * s, ry: Math.max(1.2, 1.2 * s) }, tall: false, ground: [c.cx, c.foot] };
}

function pop(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 18, (c.w * 0.9) / 24);
  const pen = c.pen(s).at(mo.push, mo.bob);
  const skin = p.mat(L.main, { deep: true }), skinD = p.mat(dark(L.main, 0.3)), cloth = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), claw = p.mat('#e0dccc', { flat: true });
  const sw = mo.pose === 'walk' ? Math.sin(mo.ph) * 2.4 : 0, strike = mo.pose === 'attack' ? [0, 1, 0.5][mo.a] : 0;
  // crouched: knees up, back round, long arms to the floor
  pen.cap([-2, -6], [-4 - sw, -0.6], 2.6, 1.7, skinD); pen.cap([2, -6], [3 + sw, -0.6], 2.8, 1.8, skin);
  pen.ell(-2, -9.5, 7, 6, cloth);
  for (let i = 0; i < 4; i++) pen.poly([[-8 + i * 3, -6], [-7 + i * 3, -1.6 - (i % 2) * 2], [-5.5 + i * 3, -6]], cloth);
  pen.cap([2, -11], [7 + strike * 8, -3 + strike * 0], 2, 1.2, skin);
  for (let i = 0; i < 3; i++) pen.line([7 + strike * 8, -3], [11 + strike * 8, -1.4 + i * 1.4 - 1.4], claw, 0.7);
  pen.cap([-3, -11], [-1 + strike * 3, -2], 1.8, 1.1, skinD);
  // the head hangs forward under its hair
  pen.ell(5, -13.5, 3.6, 3.6, skin);
  pen.poly([[1, -17], [8.2, -17], [9, -9], [6, -7], [1.5, -11]], p.mat('#2a2022', { deep: true }));
  for (let i = 0; i < 3; i++) pen.line([2 + i * 2, -12], [1.4 + i * 2, -6 + (i % 2)], p.mat('#2a2022'), 0.8);
  if (!mo.dead) { pen.dot(6.4, -13.2, eye, 1.3); pen.dot(4.4, -13.4, eye, 1.1); }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.2, 1.4 * s) }, tall: true };
}

function legion(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 30, (c.w * 0.9) / 44);
  const pen = c.pen(s).at(mo.push * 0.5, mo.bob);
  const flags = L.extra.filter((e) => e.label === 'ธง').map((e) => e.hex);
  const step = mo.pose === 'walk' ? mo.f % 2 : mo.pose === 'attack' ? mo.a : 0;
  // three ranks, the back ones higher and fainter
  const ranks: [number, number, number, number][] = [[-12, -3, 0.5, 0.55], [8, -1, 0.65, 0.7], [-2, 3, 1, 0.85]];
  ranks.forEach(([x, y, sc, a], r) => {
    const q = pen.at(x, y, pen.s * sc);
    ghostFigure(q, p, L, 0, 0, { lean: 0.8 + step, trail: (mo.f + r) % 2 + 1, alpha: a, reach: 1 + (mo.a === 1 ? 4 : 0), spear: true, dead: mo.dead });
  });
  // the five banners over the host, each a different colour
  flags.slice(0, 5).forEach((h, i) => {
    const x = -22 + i * 11, top = -40 - (i % 2) * 3, wave = (mo.f + i) % 2;
    pen.line([x, -2 + (i % 2) * 3], [x, top], p.mat('#6a6a72', { flat: true }), 0.8);
    pen.poly([[x, top], [x + 8, top + 1 + wave], [x + 7, top + 4], [x + 8, top + 7 - wave], [x, top + 6]], p.mat(h, { flat: true }));
  });
  return { shadow: { cx: c.cx, cy: c.foot, rx: 20 * s, ry: Math.max(1.6, 2 * s * 0.6) }, tall: false };
}

function crown(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 52, (c.w * 0.9) / 58);
  const pen = c.pen(s).at(mo.push * 0.4, 0);
  const bone = p.mat(L.main, { deep: true }), shadow = p.mat(L.second, { deep: true }), shadowL = p.mat(light(L.second, 0.2), { alpha: 0.85 }), ink = p.mat(L.eye, { flat: true }), cur = p.mat('#7a2a5a', { flat: true });
  const fl = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  // a throne made of shadow with writhing arms
  pen.poly([[-22, 0], [-20, -30], [-14, -44], [-9, -30], [-3, -52], [3, -32], [9, -46], [14, -30], [21, -40], [22, 0]], shadow);
  for (let i = 0; i < 6; i++) pen.chain(spine(4, (u) => [-22 + i * 9 + Math.sin(u * 4 + mo.ph + i) * 2, -u * (22 + (i % 3) * 8)]), [2.4, 2, 1.6, 1.2, 0.6], shadowL);
  const hover = -3 - fl * 1.2;
  // the king: black robe, a skull-white face, a bone crown too big for it
  pen.poly([[-10, -10 + hover], [10, -10 + hover], [13, 0], [6, -2 + fl], [0, 2], [-7, -2 - fl], [-13, 0]], p.mat('#16141c', { deep: true }));
  pen.poly([[-9, -12 + hover], [9, -12 + hover], [7, -30 + hover], [1, -34 + hover], [-6, -31 + hover]], p.mat('#1c1a24', { deep: true }));
  pen.ell(1.5, -35 + hover, 5.5, 5.8, bone);
  for (const dx of [-0.6, 3.6]) pen.ell(dx, -35.6 + hover, 1.8, 2.1, ink);
  pen.rect(-0.5, -31.8 + hover, 4, 0.8, p.mat('#14121a', { flat: true }));
  pen.poly([[-5.5, -39 + hover], [-6.5, -47 + hover], [-2.6, -42 + hover], [0.6, -49 + hover], [4, -42 + hover], [8, -47 + hover], [7.4, -39 + hover]], bone);
  // the sceptre points, and the life drains along a line of light at the strike
  const ex = mo.pose === 'attack' ? [0.3, 1, 0.6][mo.a] : 0;
  pen.line([9, -22 + hover], [16 + ex * 6, -20 + hover - ex * 6], p.mat('#16141c'), 2.6);
  pen.line([16 + ex * 6, -20 + hover - ex * 6], [22 + ex * 8, -26 + hover - ex * 10], p.mat('#9a8a80', { flat: true }), 1.1);
  pen.ell(22.6 + ex * 8, -27 + hover - ex * 10, 2.2, 2.2, bone);
  if (mo.a === 1) for (let i = 0; i < 8; i++) pen.dot(28 + i * 3.6, -34 + hover + i * 1.1 + (i % 2), i % 2 ? cur : p.mat('#d8a0c0', { flat: true }), 1.5);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 22 * s, ry: Math.max(2, 2.6 * s * 0.5) }, tall: false, ground: [c.cx, c.foot] };
}

function dream(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 38, (c.w * 0.9) / 36);
  const hover = -10 + Math.sin(mo.ph) * 1.2 + (mo.pose === 'idle' ? mo.breath * 1.6 : 0);
  const pen = c.pen(s).at(mo.push, mo.bob + hover);
  const sac = p.mat(L.main, { deep: true, alpha: 0.9 }), inner = p.mat(L.eye, { flat: true, alpha: 0.75 }), deep = p.mat(L.second, { alpha: 0.9 }), star = p.mat('#f0e8ff', { flat: true });
  const touch = mo.pose === 'attack' ? [0.2, 1, 0.5][mo.a] : 0;
  // tendrils hang from the sac; one reaches out to touch a forehead
  for (let i = 0; i < 6; i++) {
    const reach = i === 5 ? touch * 14 : 0;
    const pts = spine(7, (u) => [-6 + i * 2.6 + Math.sin(u * 5 + mo.ph + i) * 1.8 + reach * u, 5 + u * (14 + (i % 3) * 3) - reach * 0.3 * u]);
    pen.chain(pts, pts.map((_, k) => 1.8 - k * 0.2), deep);
  }
  pen.ell(0, -8, 11, 10, sac);
  pen.ell(1, -9, 8, 7, deep);
  // inside the sac: a scene of a dream, a small bed under stars
  pen.ell(1, -8, 4.4, 3.6, inner);
  pen.rect(-3, -5.6, 6.6, 1.2, p.mat('#f0e8ff', { flat: true, alpha: 0.6 }));
  for (let i = 0; i < 5; i++) pen.dot(-7 + i * 3.4, -13 + (i % 2) * 2.2, star, 0.9);
  for (let i = 0; i < 4; i++) pen.dot(-12 - i * 1.4, -4 - i * 3 - ((mo.f + i) % 2), star, 0.8);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.2, 1.4 * s) }, tall: false, ground: [c.cx, c.foot - hover * s] };
}

function mirage(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 30, (c.w * 0.9) / 36);
  const pen = c.pen(s).at(mo.push * 0.5, mo.bob);
  // three overlapping images of a walker, drifting apart and together; the nearest is the clearest
  const shimmer = mo.pose === 'idle' ? mo.breath : mo.f % 2;
  const imgs: [number, number, number][] = [[-8 + shimmer * 2, -1, 0.4], [9 - shimmer * 2, -2, 0.5], [0, 1, 0.82]];
  imgs.forEach(([x, y, a]) => {
    const body = p.mat(L.main, { deep: true, alpha: a }), edge = p.mat(L.second, { alpha: a }), eye = p.mat(L.eye, { flat: true });
    pen.poly([[x - 6, y - 16], [x + 6, y - 16], [x + 7, y - 2], [x - 7, y - 2]], body);
    pen.line([x - 6, y - 15], [x - 7, y - 2], edge, 1);
    pen.ell(x + 0.5, y - 21, 3.6, 4, body);
    pen.dot(x + 2, y - 21.4, eye, 1.2);
    pen.line([x + 4, y - 14], [x + 9 + (mo.pose === 'attack' ? mo.strike * 5 : 0), y - 11], body, 1.6);
    pen.line([x - 3, y - 2], [x - 3 - Math.sin(mo.ph) * 2, y + 0.5], edge, 1.4); pen.line([x + 3, y - 2], [x + 3 + Math.sin(mo.ph) * 2, y + 0.5], edge, 1.4);
  });
  // heat shimmer bars
  for (let i = 0; i < 4; i++) pen.line([-14 + i * 3, -26 + ((i + mo.f) % 2)], [-9 + i * 3, -26 + ((i + mo.f) % 2)], p.mat(L.second, { flat: true, alpha: 0.5 }), 0.7);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 14 * s, ry: Math.max(1.2, 1.4 * s) }, tall: false };
}

function bell(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 40, (c.w * 0.9) / 36);
  const swing = (mo.pose === 'idle' ? (mo.breath ? 0.14 : -0.14) : mo.pose === 'attack' ? [-0.3, 0.35, -0.1][mo.a] : Math.sin(mo.ph) * 0.12);
  const pen = c.pen(s).at(mo.push, mo.bob - 6);
  const body = p.mat(L.main, { deep: true, alpha: 0.88 }), rim = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), rope = p.mat('#7a6a50', { flat: true }), ink = p.mat('#0c0a14', { flat: true });
  const R = (x: number, y: number): [number, number] => [x * Math.cos(swing) - (y + 40) * Math.sin(swing), x * Math.sin(swing) + (y + 40) * Math.cos(swing) - 40];
  pen.line([0, -52], [R(0, -40)[0], R(0, -40)[1]], rope, 1.2);
  pen.poly([R(-4, -38), R(4, -38), R(8, -26), R(11, -12), R(13, -5), R(-13, -5), R(-11, -12), R(-8, -26)], body);
  pen.poly([R(-13, -5), R(13, -5), R(14, -2), R(-14, -2)], rim);
  pen.ell(...R(0, -4), 14, 2.4, ink);
  // two lights for eyes inside the mouth of the bell, a clapper like a tongue
  if (!mo.dead) { pen.dot(...R(-4, -4.2), eye, 1.6); pen.dot(...R(4, -4.2), eye, 1.6); }
  pen.line(R(0, -8), R(Math.sin(swing * 4) * 4, 3), rim, 1.5);
  pen.ell(...R(Math.sin(swing * 4) * 4, 3.5), 1.9, 1.9, rim);
  for (let i = 0; i < 3; i++) pen.line(R(-9, -24 + i * 6), R(-8, -22 + i * 6), rim, 0.7);
  if (mo.a === 1) for (let i = 1; i <= 3; i++) pen.ell(0, -15, 14 + i * 7, 10 + i * 6, p.mat(L.eye, { flat: true, alpha: 0.3 - i * 0.06 }));
  return { shadow: { cx: c.cx, cy: c.foot, rx: 12 * s, ry: Math.max(1.4, 1.6 * s) }, tall: false, ground: [c.cx, c.foot - 6 * s] };
}

function rift(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 38, (c.w * 0.9) / 44);
  const pen = c.pen(s).at(mo.push * 0.5, mo.bob);
  const cleft = p.mat(L.second, { flat: true }), core = p.mat(L.eye, { flat: true }), robe = p.mat(L.main, { deep: true }), robeD = p.mat(dark(L.main, 0.3)), mask = p.mat('#e4e4f0', { deep: true }), ink = p.mat('#100c1a', { flat: true });
  const gape = mo.pose === 'attack' ? [0.3, 1, 0.7][mo.a] : 0.5 + 0.2 * mo.breath;
  // the rift behind: a jagged crack of light that opens and shuts
  const crack = spine(8, (u) => [-6 + Math.sin(u * 9) * 3, -4 - u * 40]);
  pen.chain(crack, crack.map((_, i) => 1 + Math.sin((i / 8) * Math.PI) * (3 + gape * 7)), cleft);
  pen.chain(crack, crack.map((_, i) => 0.4 + Math.sin((i / 8) * Math.PI) * (1.2 + gape * 3.4)), core);
  // the speaker stands in front of it
  const fl = mo.pose === 'walk' ? Math.sin(mo.ph) * 1.4 : mo.breath * 0.8;
  pen.poly([[-8, -22], [8, -22], [11, -2], [5, 0 + fl], [0, -2], [-6, 0 - fl], [-11, -2]], robe);
  pen.line([-3, -21], [-5, -2], robeD, 0.9); pen.line([3, -21], [5, -2], robeD, 0.9);
  pen.line([-8, -22], [8, -22], p.mat(L.second, { deep: true }), 1.6);
  pen.ell(0.5, -28, 4.4, 5.2, mask);
  pen.rect(-1.4, -29.4, 1.8, 1.2, ink); pen.rect(2.2, -29.4, 1.8, 1.2, ink);
  if (!mo.dead) { pen.dot(-0.5, -28.8, core, 1.2); pen.dot(3.1, -28.8, core, 1.2); }
  pen.line([0.5, -25.6], [0.5, -23], ink, 0.7);
  pen.line([6, -20], [12 + (mo.pose === 'attack' ? 4 * mo.strike : 0), -16], robe, 2.4); pen.dot(12.6 + (mo.pose === 'attack' ? 4 * mo.strike : 0), -16, mask, 1.8);
  if (mo.a === 1) pen.ell(14, 0, 9, 2.4, cleft);
  return { shadow: { cx: c.cx, cy: c.foot, rx: 9 * s, ry: Math.max(1.4, 1.6 * s) }, tall: true };
}

function reactor(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 40, (c.w * 0.9) / 36);
  const hover = -12 + Math.sin(mo.ph) * 1.5 + (mo.pose === 'idle' ? mo.breath * 1.6 : 0);
  const pen = c.pen(s).at(mo.push, mo.bob + hover);
  const fire = p.mat(L.main, { deep: true }), arc = p.mat(L.second, { flat: true }), white = p.mat(L.eye, { flat: true }), ring = p.mat('#6a6a74', { deep: true }), hot = p.mat(light(L.main, 0.45), { flat: true });
  // a ring of the furnace it was sealed in
  pen.ell(0, 0, 16, 16, ring);
  pen.ell(0, 0, 13, 13, p.mat('#24242c', { flat: true }));
  const pulse = mo.pose === 'idle' ? mo.breath : mo.pose === 'attack' ? [0, 1, 0.4][mo.a] : mo.f % 2;
  pen.ell(0, 0, 10 + pulse, 10 + pulse, fire);
  pen.ell(0, 0, 6.5 + pulse * 0.6, 6.5 + pulse * 0.6, hot);
  pen.ell(0, 0, 3.2, 3.2, white);
  // flames lick up, arcs of the second colour leap out
  for (let i = 0; i < 7; i++) { const a = -Math.PI + (i / 6) * Math.PI; pen.poly([[Math.cos(a) * 8, Math.sin(a) * 8], [Math.cos(a + 0.18) * (14 + ((mo.f + i) % 3) * 2), Math.sin(a + 0.18) * (14 + ((mo.f + i) % 3) * 2)], [Math.cos(a + 0.4) * 8, Math.sin(a + 0.4) * 8]], fire); }
  const arcs = mo.pose === 'attack' ? 3 : 1;
  for (let k = 0; k < arcs; k++) {
    let x = 10, y = -2 + k * 3;
    for (let i = 0; i < 6; i++) { const nx = x + 3.2 + (mo.pose === 'attack' ? 2 : 0), ny = y + (rnd(L.id, i + k * 9 + mo.f * 3) - 0.5) * 7; pen.line([x, y], [nx, ny], arc, 0.9); x = nx; y = ny; }
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 8 * s, ry: Math.max(1.2, 1.4 * s) }, tall: false, ground: [c.cx, c.foot - hover * s] };
}

function djinn(c: Ctx<EnemyLook>): Info {
  const { L, mo, p } = c;
  const s = Math.min(c.px / 60, (c.w * 0.5) / 28);
  const pen = c.pen(s).at(mo.push * 0.5, mo.bob);
  const sand = p.mat(L.main, { deep: true }), sandD = p.mat(L.second, { deep: true }), eye = p.mat(L.eye, { flat: true }), skin = p.mat(mix(L.main, L.second, 0.5), { deep: true }), grain = p.mat(light(L.main, 0.4), { flat: true });
  // a whirlwind from the ground: stacked, offset rings that turn
  for (let i = 0; i < 9; i++) {
    const y = -i * 3.4 - 2, r = 4 + i * 1.7, sh = Math.sin(i * 1.1 + mo.ph + mo.f) * 2.4;
    pen.ell(sh, y, r, 2.4, i % 2 ? sand : sandD);
    pen.dot(sh + r * (i % 2 ? 0.9 : -0.9), y - 1, grain, 1.1);
  }
  // the djinn: a chest and crossed arms rising from the funnel
  pen.ell(0, -34, 9.5, 8, skin);
  pen.cap([-8, -37], [3, -31], 3, 2.6, skin); pen.cap([8, -37], [-2, -31], 3, 2.6, sand);
  pen.rect(-9, -29, 18, 3, sandD);
  pen.ell(1.4, -46, 4.6, 5, skin);
  pen.poly([[-3.6, -49], [-2, -57 - (mo.f % 2)], [0.6, -51], [3, -59], [4.6, -50], [6, -55], [6, -48]], sand);
  if (!mo.dead) { pen.dot(0.8, -46.6, eye, 1.5); pen.dot(4, -46.6, eye, 1.5); }
  // a blade of packed sand swung at the strike
  if (mo.pose === 'attack') {
    const a = [-1.9, 0.4, -0.3][mo.a], hx = 10, hy = -36;
    pen.line([hx, hy], [hx + Math.cos(a) * 24, hy + Math.sin(a) * 24], p.mat(light(L.main, 0.2)), 2.6);
    if (mo.a === 1) for (let i = 0; i < 8; i++) pen.dot(hx + 6 + i * 3, hy + 14 + (i % 3) * 2, grain, 1.2);
  }
  return { shadow: { cx: c.cx, cy: c.foot, rx: 14 * s, ry: Math.max(2, 2 * s * 0.5) }, tall: false, ground: [c.cx, c.foot] };
}
